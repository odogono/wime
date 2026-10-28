// The Atlas map's WebGL2 renderer (ADR-0006). It draws, in order: the
// Terrain Region fills, their ink edges and the rivers, the scattered
// terrain symbols, and then a screen-space layer of Force emblems,
// markers and lettering built fresh each frame.
import { NO_SEGMENT, type GeographyBundle } from './bundle';
import type { EmblemAtlas } from './emblems';
import { PEAKS, type PictogramAtlas } from './pictograms';
import type { SdfFont } from './sdf-font';

export interface View {
  devicePixelRatio: number;
  // Device pixels.
  height: number;
  width: number;
  // The map point at the top left of the view, and CSS pixels per map
  // pixel.
  x: number;
  y: number;
  zoom: number;
}

// One screen-space quad: an emblem, a marker or a glyph.
export interface Quad {
  colour: [number, number, number, number];
  // For glyphs: the field's edge threshold, lower for a halo.
  edge?: number;
  h: number;
  mode: QuadMode;
  // Texture rectangle in texels (emblems, glyphs) or unused (markers).
  u0?: number;
  u1?: number;
  v0?: number;
  v1?: number;
  w: number;
  // Top left and size, in device pixels.
  x: number;
  y: number;
}

export const QuadMode = {
  circle: 2,
  // An Emblem's outline alone, in its colour with an ink rim.
  compact: 5,
  // A Force's Emblem: its field in the quad's colour, the device in
  // parchment and the ink over both.
  emblem: 0,
  glyph: 1,
  // A Place's ink picture, from the pictogram atlas.
  pictogram: 4,
  square: 3
} as const;
export type QuadMode = (typeof QuadMode)[keyof typeof QuadMode];

const hex = (value: string): [number, number, number] => {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
};

// Parchment fills, after the Tolkien maps' paper and washes.
const REGION_COLOURS: Record<string, string> = {
  forest: '#dcdcb2',
  hill: '#ead8aa',
  marsh: '#dfe3c6',
  mountain: '#e4d6bb',
  plain: '#f0e4c4',
  // Rivers are drawn as ink lines over parchment.
  river: '#f0e4c4',
  water: '#bfd0c8'
};
export const INK = '#3a2c1c';
export const PAPER = '#f0e4c4';
// Ink line widths in CSS pixels at the Campaign Level's scale.
const LINE_STYLE: Record<string, { colour: string; width: number }> = {
  coast: { colour: '#2f3d44', width: 1.5 },
  forest: { colour: '#4a4a22', width: 0.9 },
  mountain: { colour: '#5a4632', width: 0.8 },
  river: { colour: '#3c5a66', width: 0.9 },
  road: { colour: '#7a4c2c', width: 1.3 }
};
// Roads are dashed, in CSS pixels on and off.
const DASH = [5, 3];
// Each symbol's size in map pixels.
// Tree, peak, hill, marsh, bridge, ford.
const SYMBOL_SIZE = [10, 17, 13, 11, 16, 16];

const compile = (
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string
): WebGLProgram => {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment]
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(
      shader,
      `#version 300 es\nprecision highp float;\n${source}`
    );
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed');
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
  }
  return program;
};

const MAP_TRANSFORM = `
uniform vec4 u_view; // scale x, scale y, offset x, offset y: map pixels to clip space
uniform float u_fixed; // the bundle stores map pixels times this
vec2 toClip(vec2 p) { return p * u_view.xy + u_view.zw; }
`;

const FILL_VS = `${MAP_TRANSFORM}
layout(location = 0) in vec2 a_pos;
layout(location = 1) in float a_kind;
uniform vec3 u_colours[7];
out vec3 v_colour;
out vec2 v_map;
flat out int v_kind;
void main() {
  v_colour = u_colours[int(a_kind)];
  v_map = a_pos / u_fixed;
  v_kind = int(a_kind);
  gl_Position = vec4(toClip(v_map), 0.0, 1.0);
}`;

const FILL_FS = `
in vec3 v_colour;
in vec2 v_map;
flat in int v_kind;
uniform float u_zoom;
out vec4 colour;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // A faint paper grain, fixed to the map.
  float grain = hash(floor(v_map * 2.0)) * 0.035 - 0.0175;
  vec3 c = v_colour + grain;
  // Open water carries the fine horizontal lines of an engraved sea.
  if (v_kind == 0) {
    float period = 5.0;
    float d = abs(fract(v_map.y / period) - 0.5) * period;
    float line = 1.0 - smoothstep(0.0, 0.5 / max(u_zoom, 0.01) + 0.35, d);
    c = mix(c, vec3(0.42, 0.53, 0.55), line * 0.35 * smoothstep(0.4, 1.2, u_zoom));
  }
  colour = vec4(c, 1.0);
}`;

// One segment per instance, from a point to the next, widened here.
const LINE_VS = `${MAP_TRANSFORM}
layout(location = 0) in vec2 a_from;
layout(location = 1) in float a_along;
layout(location = 2) in float a_style;
layout(location = 3) in vec2 a_to;
layout(location = 4) in float a_alongTo;
layout(location = 5) in vec2 a_corner; // 0 or 1 along the segment, then side
layout(location = 6) in float a_width; // quarters of a map pixel; 0 for the style's
layout(location = 7) in float a_widthTo;
uniform float u_mapScale; // device pixels per map pixel
uniform float u_widths[5]; // half widths in device pixels
uniform vec4 u_colours[5];
uniform vec2 u_pixel; // one device pixel in clip space
out vec4 v_colour;
out float v_along;
flat out int v_style;
void main() {
  int s = int(a_style);
  // ${NO_SEGMENT} ends a run of line: nothing joins it to the next point.
  if (s >= ${NO_SEGMENT}) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 from = a_from / u_fixed;
  vec2 to = a_to / u_fixed;
  vec2 dir = normalize(to - from);
  vec2 normal = vec2(-dir.y, dir.x) * a_corner.y;
  v_colour = u_colours[s];
  v_along = mix(a_along, a_alongTo, a_corner.x);
  v_style = s;
  // A line with its own width, such as a river, follows it.
  float own = mix(a_width, a_widthTo, a_corner.x) / 4.0 * u_mapScale / 2.0;
  // Held to between the style's own width and three times it on screen,
  // so the ink tapers but never swamps the map.
  float halfWidth = a_width > 0.0 ? clamp(own * 0.5, u_widths[s], u_widths[s] * 3.0) : u_widths[s];
  vec2 clip = toClip(mix(from, to, a_corner.x)) + vec2(normal.x, -normal.y) * halfWidth * u_pixel;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const LINE_FS = `
in vec4 v_colour;
in float v_along;
flat in int v_style;
uniform float u_zoom;
uniform vec2 u_dash; // CSS pixels on and off
out vec4 colour;
void main() {
  // Roads are dashed at a fixed size on screen.
  if (v_style == 4 && mod(v_along * u_zoom, u_dash.x + u_dash.y) > u_dash.x) discard;
  colour = v_colour;
}`;

const SYMBOL_VS = `${MAP_TRANSFORM}
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_pos;
layout(location = 2) in float a_kind;
layout(location = 3) in float a_variant;
layout(location = 4) in float a_rank;
// A crossing's angle, 0 to 255 over half a turn; a peak's or hill's
// jitter, its tilt in the low four bits and its scale in the high four.
layout(location = 5) in float a_angle;
uniform float u_sizes[6]; // device pixels
uniform float u_mapScale; // device pixels per map pixel
uniform float u_peakPad; // an atlas cell's size over its drawing's
uniform float u_maxRank;
uniform vec2 u_pixel;
out vec2 v_local;
flat out int v_kind;
flat out float v_variant;
flat out float v_size;
void main() {
  int k = int(a_kind);
  float size = a_rank > u_maxRank ? 0.0 : u_sizes[k] * (0.85 + mod(a_variant, 3.0) * 0.12);
  // A crossing spans its water: its variant is that width in map pixels.
  if (k >= 4) size = max(u_sizes[k], (a_variant + 8.0) * u_mapScale);
  // A peak's variant is its size class times 3 plus its lean, or a
  // foothill's size class times 7 plus its shape (from 32). Its quad
  // covers the atlas cell, margin and all.
  float sizeClass = a_variant >= 32.0 ? floor((a_variant - 32.0) / 7.0) : floor(mod(a_variant, 16.0) / 3.0);
  if (k == 1 && a_rank <= u_maxRank) size = u_sizes[k] * (0.9 + sizeClass * 0.3) * u_peakPad;
  v_local = a_corner;
  v_kind = k;
  v_variant = a_variant;
  v_size = size;
  // Crossings lie along their road; x in the symbol runs with it.
  float angle = a_angle / 255.0 * 3.14159265;
  if (k == 1 || k == 2) {
    // Up to about 6 degrees either way, and 12% larger or smaller.
    angle = (mod(a_angle, 16.0) / 15.0 - 0.5) * 0.2;
    size *= 0.88 + floor(a_angle / 16.0) / 15.0 * 0.24;
  }
  vec2 corner = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * a_corner;
  gl_Position = vec4(toClip(a_pos / u_fixed) + corner * 0.5 * size * u_pixel * vec2(1.0, -1.0), 0.0, 1.0);
}`;

// Ink drawn procedurally in each symbol's square, from -1 to 1 with y down.
const SYMBOL_FS = `
in vec2 v_local;
flat in int v_kind;
flat in float v_variant;
flat in float v_size;
uniform vec3 u_ink;
uniform vec3 u_paper;
uniform vec3 u_leaf;
uniform vec3 u_marsh;
uniform sampler2D u_pictograms;
uniform vec2 u_pictogramSize;
uniform vec2 u_peakCells[16]; // each peak shape's cell origin, in texels
uniform float u_peakCell; // a cell's size, in texels
out vec4 colour;
float stroke(float d, float w, float aa) { return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
float fill(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }
float sdTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  vec2 v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
void main() {
  vec2 p = v_local;
  float aa = 2.0 / max(v_size, 1.0);
  float w = max(0.07, 1.6 / max(v_size, 1.0));
  vec4 c = vec4(0.0);
  if (v_kind == 0) {
    // A tree: a round crown over a short trunk.
    float r = 0.55 + v_variant * 0.05;
    float crown = length(p - vec2(0.0, -0.2)) - r;
    float trunk = max(abs(p.x) - 0.05, abs(p.y - 0.6) - 0.28);
    float body = fill(crown, aa);
    c = vec4(u_leaf, body);
    float ink = max(stroke(crown, w, aa), fill(trunk, aa));
    c = mix(c, vec4(u_ink, 1.0), ink);
  } else if (v_kind == 1) {
    // A peak, drawn from the pictogram atlas: red is ink, green paper.
    bool dark = v_variant >= 16.0 && v_variant < 32.0;
    float variant = dark ? v_variant - 16.0 : v_variant;
    int size = int(variant / 3.0);
    int lean = int(mod(variant, 3.0));
    // Foothills: the two low peaks, then the foothill shapes.
    int foothill = int(mod(v_variant - 32.0, 7.0));
    int shape = v_variant >= 32.0 ? (foothill < 2 ? foothill : 9 + foothill)
      : dark ? (size <= 1 ? 10 : 8 + lean % 2)
      : size == 0 ? 6 + lean % 2
      : size == 1 ? (lean == 0 ? 3 : 6 + lean % 2)
      : size == 2 ? 3 + lean
      : size == 3 ? (lean == 2 ? 4 : lean)
      : lean;
    vec2 uv = u_peakCells[shape] + (p * 0.5 + 0.5) * u_peakCell;
    vec2 t = texture(u_pictograms, uv / u_pictogramSize).rg;
    float edge = max(fwidth(t.r), fwidth(t.g)) * 0.75;
    float ink = smoothstep(0.5 - edge, 0.5 + edge, t.r);
    float body = smoothstep(0.5 - edge, 0.5 + edge, t.g);
    c = vec4(mix(u_paper, u_ink, ink), max(ink, body));
  } else if (v_kind == 2) {
    // A hill: a rounded mound, inked over its crest, its eastern flank
    // shaded with short strokes, as on Tolkien's maps. Its variant is its
    // shape times 3 plus its lean; the shapes are a dome, a broad low
    // mound and a pair of humps.
    float lean = (mod(v_variant, 3.0) - 1.0) * 0.1;
    int form = int(v_variant / 3.0);
    vec2 q = vec2(p.x - lean, p.y);
    // Ellipses sitting on the baseline, their distance roughly in the
    // symbol's own units.
    float mound = form == 1
      ? (length(vec2(q.x / 1.0, (q.y - 0.55) / 0.8)) - 1.0) * 0.85
      : form == 2
      ? min((length(vec2((q.x + 0.32) / 0.62, (q.y - 0.55) / 1.0)) - 1.0) * 0.7,
            (length(vec2((q.x - 0.4) / 0.55, (q.y - 0.55) / 0.72)) - 1.0) * 0.6)
      : (length(vec2(q.x / 0.95, (q.y - 0.55) / 1.1)) - 1.0) * 0.95;
    float upper = step(q.y, 0.55);
    float body = fill(mound, aa) * upper;
    float shade = stroke(fract(q.x * 4.0 + q.y * 1.5) - 0.5, 0.1, 0.08) * step(0.12, q.x) * body;
    c = vec4(u_paper, body * 0.9);
    c = mix(c, vec4(u_ink, 1.0), max(stroke(mound, w, aa) * upper, shade * 0.6));
  } else if (v_kind == 4) {
    // A bridge: a paper deck over the water between two parapets that
    // splay at either end.
    float splay = smoothstep(0.55, 0.95, abs(p.x)) * 0.2;
    float half_ = 0.32 + splay;
    float deck = max(abs(p.y) - half_, abs(p.x) - 0.95);
    float parapets = max(abs(abs(p.y) - half_) - w * 0.7, abs(p.x) - 0.95);
    c = vec4(u_paper, fill(deck, aa));
    c = mix(c, vec4(u_ink, 1.0), fill(parapets, aa));
  } else if (v_kind == 5) {
    // A ford: a staggered line of small stepping stones along the road,
    // paper outlined in ink.
    float stones = 1e3;
    for (int i = -2; i <= 2; i++) {
      vec2 c = vec2(float(i) * 0.36, (mod(float(i), 2.0) - 0.5) * 0.14);
      stones = min(stones, length((p - c) * vec2(1.0, 1.35)) - 0.11);
    }
    c = vec4(u_paper, fill(stones, aa));
    c = mix(c, vec4(u_ink, 1.0), stroke(stones, w * 0.5, aa));
  } else {
    // A marsh tuft: a short ground line with reeds rising from it.
    float ground = max(abs(p.y - 0.55) - w * 0.6, abs(p.x) - 0.75);
    float reeds = 1e3;
    for (int i = -1; i <= 1; i++) {
      float x = float(i) * 0.32 + (v_variant - 1.0) * 0.06;
      float height = 0.55 - abs(float(i)) * 0.25;
      float tilt = float(i) * 0.18;
      float r = max(abs(p.x - x - (0.55 - p.y) * tilt) - w * 0.5, abs(p.y - (0.55 - height / 2.0)) - height / 2.0);
      reeds = min(reeds, r);
    }
    c = vec4(u_marsh, max(fill(ground, aa), fill(reeds, aa)));
  }
  if (c.a < 0.01) discard;
  colour = c;
}`;

const SCREEN_VS = `
layout(location = 0) in vec2 a_pos; // device pixels
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_colour;
layout(location = 3) in vec2 a_modeEdge;
uniform vec2 u_screen;
out vec2 v_uv;
out vec4 v_colour;
flat out int v_mode;
out float v_edge;
void main() {
  v_uv = a_uv;
  v_colour = a_colour;
  v_mode = int(a_modeEdge.x);
  v_edge = a_modeEdge.y;
  gl_Position = vec4(a_pos / u_screen * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}`;

const SCREEN_FS = `
in vec2 v_uv;
in vec4 v_colour;
flat in int v_mode;
in float v_edge;
uniform sampler2D u_emblems;
uniform sampler2D u_font;
uniform vec2 u_emblemSize;
// Texels the emblem field spans either side of an edge, and the
// Compact marker's rim in texels.
uniform float u_emblemRadius;
uniform float u_emblemRim;
uniform vec3 u_device;
uniform vec2 u_fontSize;
uniform vec3 u_ink;
uniform vec3 u_paper;
uniform sampler2D u_pictograms;
uniform vec2 u_pictogramSize;
out vec4 colour;

void main() {
  if (v_mode == 4) {
    // A Place's picture: red is its ink, green its paper body.
    vec2 t = texture(u_pictograms, v_uv / u_pictogramSize).rg;
    float aa = max(fwidth(t.r), fwidth(t.g)) * 0.75;
    float ink = smoothstep(0.5 - aa, 0.5 + aa, t.r);
    float body = smoothstep(0.5 - aa, 0.5 + aa, t.g);
    float a = max(ink, body);
    if (a < 0.01) discard;
    colour = vec4(mix(u_paper, u_ink, ink), a * v_colour.a);
  } else if (v_mode == 0) {
    // An Emblem: red is ink, green the silhouette, blue the device.
    vec3 t = texture(u_emblems, v_uv / u_emblemSize).rgb;
    vec3 aa = fwidth(t) * 0.75;
    vec3 on = smoothstep(0.5 - aa, 0.5 + aa, t);
    if (on.g < 0.01) discard;
    vec3 c = mix(mix(v_colour.rgb, u_device, on.b), u_ink, on.r);
    colour = vec4(c, on.g * v_colour.a);
  } else if (v_mode == 5) {
    // A Compact marker: the silhouette, with an ink rim cut from its own
    // field, at least a device pixel wide.
    float g = texture(u_emblems, v_uv / u_emblemSize).g;
    float aa = fwidth(g) * 0.75;
    float body = smoothstep(0.5 - aa, 0.5 + aa, g);
    if (body < 0.01) discard;
    float texel = length(fwidth(v_uv)) * 0.7071;
    float depth = (g * 255.0 - 128.0) / 127.0 * u_emblemRadius;
    float rimWidth = max(u_emblemRim, texel);
    float rim = 1.0 - smoothstep(rimWidth - texel * 0.5, rimWidth + texel * 0.5, depth);
    colour = vec4(mix(v_colour.rgb, u_ink, rim), body * v_colour.a);
  } else if (v_mode == 1) {
    float d = texture(u_font, v_uv / u_fontSize).r;
    float aa = fwidth(d) * 0.75;
    float a = smoothstep(v_edge - aa, v_edge + aa, d);
    if (a < 0.01) discard;
    colour = vec4(v_colour.rgb, v_colour.a * a);
  } else {
    // A marker: a disc or a rounded square with an ink rim.
    vec2 p = v_uv;
    float d = v_mode == 2 ? length(p) - 1.0 : max(abs(p.x), abs(p.y)) - 1.0;
    float aa = fwidth(d) * 1.2;
    float body = 1.0 - smoothstep(-aa, aa, d);
    float rim = smoothstep(-0.32 - aa, -0.32 + aa, d);
    if (body < 0.01) discard;
    colour = vec4(mix(v_colour.rgb, u_ink, rim), body * v_colour.a);
  }
}`;

export class AtlasRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly fill: {
    count: number;
    firstIndex: number;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
  }[];
  private readonly fixedPoint: number;
  private readonly lines: {
    count: number;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
  };
  private readonly symbols: {
    count: number;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
  };
  private readonly screen: {
    buffer: WebGLBuffer;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
  };
  private readonly emblems: EmblemAtlas;
  private readonly pictogramSize: [number, number];
  private readonly peakCells: number[];
  private readonly peakCell: number;
  private readonly peakMargin: number;
  private readonly fontSize: [number, number];
  private readonly lineStyles: string[];

  constructor(
    canvas: HTMLCanvasElement,
    bundle: GeographyBundle,
    font: SdfFont,
    emblems: EmblemAtlas,
    pictograms: PictogramAtlas
  ) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false
    });
    if (!gl) {
      throw new Error('WebGL2 is not available');
    }
    this.gl = gl;
    this.lineStyles = bundle.lineStyles;

    const vao = (setup: () => void): WebGLVertexArrayObject => {
      const v = gl.createVertexArray();
      gl.bindVertexArray(v);
      setup();
      gl.bindVertexArray(null);
      return v;
    };
    const upload = (
      data: ArrayBufferView,
      target: GLenum = gl.ARRAY_BUFFER
    ): WebGLBuffer => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    };
    // Point an attribute into the bound buffer: `type` is a GL type, its
    // values read as floats without normalising.
    const pointer = (
      location: number,
      size: number,
      type: GLenum,
      stride: number,
      offset: number,
      divisor = 0
    ): void => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, type, false, stride, offset);
      gl.vertexAttribDivisor(location, divisor);
    };
    const attribs = (
      layout: [number, number][],
      stride: number,
      divisor = 0
    ): void => {
      let offset = 0;
      layout.forEach(([location, size]) => {
        pointer(location, size, gl.FLOAT, stride * 4, offset * 4, divisor);
        offset += size;
      });
    };
    this.fixedPoint = bundle.fixedPoint;

    // Fill: one vertex array per chunk, each reading its own run of the
    // shared vertex buffer, so 16-bit indices reach every vertex.
    const fillVertices = upload(bundle.fillVertices.bytes);
    const fillIndices = upload(
      bundle.fillIndices.bytes,
      gl.ELEMENT_ARRAY_BUFFER
    );
    const fillProgram = compile(gl, FILL_VS, FILL_FS);
    this.fill = bundle.fillChunks.map((chunk, i) => ({
      count:
        (bundle.fillChunks[i + 1]?.firstIndex ?? bundle.fillIndices.count) -
        chunk.firstIndex,
      firstIndex: chunk.firstIndex,
      program: fillProgram,
      vao: vao(() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, fillVertices);
        pointer(0, 2, gl.UNSIGNED_SHORT, 6, chunk.firstVertex * 6);
        pointer(1, 1, gl.UNSIGNED_SHORT, 6, chunk.firstVertex * 6 + 4);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fillIndices);
      })
    }));
    this.lines = {
      count: Math.max(0, bundle.linePoints.count - 1),
      program: compile(gl, LINE_VS, LINE_FS),
      vao: vao(() => {
        upload(new Float32Array([0, 1, 0, -1, 1, 1, 1, 1, 0, -1, 1, -1]));
        pointer(5, 2, gl.FLOAT, 8, 0);
        // Each instance reads a point and the one after it.
        upload(bundle.linePoints.bytes);
        pointer(0, 2, gl.UNSIGNED_SHORT, 12, 0, 1);
        pointer(1, 1, gl.FLOAT, 12, 4, 1);
        pointer(2, 1, gl.UNSIGNED_BYTE, 12, 8, 1);
        pointer(3, 2, gl.UNSIGNED_SHORT, 12, 12, 1);
        pointer(4, 1, gl.FLOAT, 12, 16, 1);
        pointer(6, 1, gl.UNSIGNED_BYTE, 12, 9, 1);
        pointer(7, 1, gl.UNSIGNED_BYTE, 12, 21, 1);
      })
    };
    this.symbols = {
      count: bundle.symbols.count,
      program: compile(gl, SYMBOL_VS, SYMBOL_FS),
      vao: vao(() => {
        upload(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
        pointer(0, 2, gl.FLOAT, 8, 0);
        upload(bundle.symbols.bytes);
        pointer(1, 2, gl.UNSIGNED_SHORT, 8, 0, 1);
        pointer(2, 1, gl.UNSIGNED_BYTE, 8, 4, 1);
        pointer(3, 1, gl.UNSIGNED_BYTE, 8, 5, 1);
        pointer(4, 1, gl.UNSIGNED_BYTE, 8, 6, 1);
        pointer(5, 1, gl.UNSIGNED_BYTE, 8, 7, 1);
      })
    };
    const screenBuffer = gl.createBuffer();
    this.screen = {
      buffer: screenBuffer,
      program: compile(gl, SCREEN_VS, SCREEN_FS),
      vao: vao(() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer);
        attribs(
          [
            [0, 2],
            [1, 2],
            [2, 4],
            [3, 2]
          ],
          10
        );
      })
    };

    const texture = (unit: number, setup: () => void, filter: GLenum): void => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      setup();
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    texture(
      0,
      () =>
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB8,
          emblems.width,
          emblems.height,
          0,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          emblems.texture
        ),
      gl.LINEAR
    );
    texture(
      1,
      () =>
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R8,
          font.texture.width,
          font.texture.height,
          0,
          gl.RED,
          gl.UNSIGNED_BYTE,
          font.texture.data
        ),
      gl.LINEAR
    );
    texture(
      2,
      () =>
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RG8,
          pictograms.texture.width,
          pictograms.texture.height,
          0,
          gl.RG,
          gl.UNSIGNED_BYTE,
          pictograms.texture.data
        ),
      gl.LINEAR
    );
    this.pictogramSize = [pictograms.texture.width, pictograms.texture.height];
    this.peakCells = PEAKS.flatMap(name => {
      const cell = pictograms.cells.get(name);
      return cell ? [cell.u, cell.v] : [0, 0];
    });
    this.peakCell = pictograms.cell;
    this.peakMargin = pictograms.margin;
    this.emblems = emblems;
    this.fontSize = [font.texture.width, font.texture.height];
  }

  // Draw the map, then the screen-space quads over it. `maxRank` is the
  // least detailed rank of symbol still drawn; `lineScale` thins the ink
  // as the map zooms out, and `roadOpacity` fades the roads out with it.
  draw(
    view: View,
    quads: Quad[],
    maxRank: number,
    lineScale: number,
    roadOpacity: number
  ): void {
    const { gl } = this;
    gl.viewport(0, 0, view.width, view.height);
    gl.clearColor(0.11, 0.1, 0.09, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const scale = view.zoom * view.devicePixelRatio;
    const sx = (2 * scale) / view.width;
    const sy = (-2 * scale) / view.height;
    const viewUniform = [sx, sy, -view.x * sx - 1, -view.y * sy + 1] as const;
    const pixel = [2 / view.width, 2 / view.height] as const;
    const set = (
      program: WebGLProgram
    ): ((name: string) => WebGLUniformLocation | null) => {
      gl.useProgram(program);
      gl.uniform4f(gl.getUniformLocation(program, 'u_view'), ...viewUniform);
      gl.uniform1f(gl.getUniformLocation(program, 'u_fixed'), this.fixedPoint);
      return name => gl.getUniformLocation(program, name);
    };

    let u = set(this.fill[0]!.program);
    gl.uniform3fv(
      u('u_colours'),
      [
        'water',
        'plain',
        'forest',
        'hill',
        'mountain',
        'river',
        'marsh'
      ].flatMap(k => hex(REGION_COLOURS[k]!))
    );
    gl.uniform1f(u('u_zoom'), view.zoom);
    for (const chunk of this.fill) {
      gl.bindVertexArray(chunk.vao);
      gl.drawElements(
        gl.TRIANGLES,
        chunk.count,
        gl.UNSIGNED_SHORT,
        chunk.firstIndex * 2
      );
    }

    u = set(this.lines.program);
    gl.uniform1fv(
      u('u_widths'),
      this.lineStyles.map(
        s =>
          Math.max(0.35, (LINE_STYLE[s]!.width * lineScale) / 2) *
          view.devicePixelRatio
      )
    );
    gl.uniform4fv(
      u('u_colours'),
      this.lineStyles.flatMap(s => [
        ...hex(LINE_STYLE[s]!.colour),
        s === 'road' ? 0.9 * roadOpacity : 0.85
      ])
    );
    gl.uniform1f(u('u_zoom'), view.zoom);
    gl.uniform2f(u('u_dash'), DASH[0]!, DASH[1]!);
    gl.uniform1f(u('u_mapScale'), view.zoom * view.devicePixelRatio);
    gl.uniform2f(u('u_pixel'), ...pixel);
    gl.bindVertexArray(this.lines.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.lines.count);

    u = set(this.symbols.program);
    gl.uniform1fv(
      u('u_sizes'),
      SYMBOL_SIZE.map(
        size =>
          Math.min(30, Math.max(5, size * view.zoom)) * view.devicePixelRatio
      )
    );
    gl.uniform1f(u('u_maxRank'), maxRank);
    gl.uniform1f(u('u_mapScale'), view.zoom * view.devicePixelRatio);
    gl.uniform1i(u('u_pictograms'), 2);
    gl.uniform2f(u('u_pictogramSize'), ...this.pictogramSize);
    gl.uniform2fv(u('u_peakCells'), this.peakCells);
    gl.uniform1f(u('u_peakCell'), this.peakCell);
    gl.uniform1f(
      u('u_peakPad'),
      this.peakCell / (this.peakCell - this.peakMargin * 2)
    );
    gl.uniform2f(u('u_pixel'), ...pixel);
    gl.uniform3f(u('u_ink'), ...hex(INK));
    gl.uniform3f(u('u_paper'), ...hex('#efe4c8'));
    gl.uniform3f(u('u_leaf'), ...hex('#b9bf86'));
    gl.uniform3f(u('u_marsh'), ...hex('#3c5a52'));
    gl.bindVertexArray(this.symbols.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.symbols.count);

    this.drawQuads(view, quads);
    gl.bindVertexArray(null);
  }

  private drawQuads(view: View, quads: Quad[]): void {
    const { gl } = this;
    const data = new Float32Array(quads.length * 6 * 10);
    let i = 0;
    for (const q of quads) {
      const marker = q.mode === QuadMode.circle || q.mode === QuadMode.square;
      const [u0, v0, u1, v1] = marker
        ? [-1, -1, 1, 1]
        : [q.u0!, q.v0!, q.u1!, q.v1!];
      const corners = [
        [q.x, q.y, u0, v0],
        [q.x + q.w, q.y, u1, v0],
        [q.x, q.y + q.h, u0, v1],
        [q.x, q.y + q.h, u0, v1],
        [q.x + q.w, q.y, u1, v0],
        [q.x + q.w, q.y + q.h, u1, v1]
      ];
      for (const c of corners) {
        data.set([...c, ...q.colour, q.mode, q.edge ?? 0.5], i);
        i += 10;
      }
    }
    const program = this.screen.program;
    gl.useProgram(program);
    const u = (name: string): WebGLUniformLocation | null =>
      gl.getUniformLocation(program, name);
    gl.uniform2f(u('u_screen'), view.width, view.height);
    gl.uniform1i(u('u_emblems'), 0);
    gl.uniform2f(u('u_emblemSize'), this.emblems.width, this.emblems.height);
    gl.uniform1f(u('u_emblemRadius'), this.emblems.radius);
    // The sheet's 3-unit rim, in texels of the 64-unit box.
    gl.uniform1f(
      u('u_emblemRim'),
      (3 * (this.emblems.cell - this.emblems.margin * 2)) / 64
    );
    gl.uniform3f(u('u_device'), ...hex(PAPER));
    gl.uniform1i(u('u_font'), 1);
    gl.uniform1i(u('u_pictograms'), 2);
    gl.uniform2f(u('u_pictogramSize'), ...this.pictogramSize);
    gl.uniform2f(u('u_fontSize'), ...this.fontSize);
    gl.uniform3f(u('u_ink'), ...hex(INK));
    gl.uniform3f(u('u_paper'), ...hex('#f4ead0'));
    gl.bindVertexArray(this.screen.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.screen.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, quads.length * 6);
  }
}
