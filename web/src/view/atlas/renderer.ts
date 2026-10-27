// The Atlas map's WebGL2 renderer (ADR-0006). It draws, in order: the
// Terrain Region fills, their ink edges and the rivers, the scattered
// terrain symbols, and then a screen-space layer of Force sprites,
// markers and lettering built fresh each frame.
import type { GeographyBundle } from './bundle';
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

// One screen-space quad: a sprite, a marker or a glyph.
export interface Quad {
  colour: [number, number, number, number];
  // For glyphs: the field's edge threshold, lower for a halo.
  edge?: number;
  h: number;
  mode: QuadMode;
  // Texture rectangle in texels (sprites, glyphs) or unused (markers).
  u0?: number;
  u1?: number;
  v0?: number;
  v1?: number;
  w: number;
  // Top left and size, in device pixels.
  x: number;
  y: number;
}

export const QuadMode = { circle: 2, glyph: 1, sprite: 0, square: 3 } as const;
export type QuadMode = (typeof QuadMode)[keyof typeof QuadMode];

const hex = (value: string): [number, number, number] => {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
};

// Parchment fills, after the Tolkien maps' paper and washes.
const REGION_COLOURS: Record<string, string> = {
  forest: '#dcdcb2',
  hill: '#ecdcb2',
  mountain: '#e4d6bb',
  plain: '#f0e4c4',
  river: '#a9c2c4',
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
const SYMBOL_SIZE = [10, 15, 18];

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
vec2 toClip(vec2 p) { return p * u_view.xy + u_view.zw; }
`;

const FILL_VS = `${MAP_TRANSFORM}
layout(location = 0) in vec2 a_pos;
layout(location = 1) in float a_kind;
uniform vec3 u_colours[6];
out vec3 v_colour;
out vec2 v_map;
flat out int v_kind;
void main() {
  v_colour = u_colours[int(a_kind)];
  v_map = a_pos;
  v_kind = int(a_kind);
  gl_Position = vec4(toClip(a_pos), 0.0, 1.0);
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

const LINE_VS = `${MAP_TRANSFORM}
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_normal;
layout(location = 2) in float a_style;
layout(location = 3) in float a_along;
uniform float u_widths[5]; // half widths in device pixels
uniform vec4 u_colours[5];
uniform vec2 u_pixel; // one device pixel in clip space
out vec4 v_colour;
out float v_along;
flat out int v_style;
void main() {
  int s = int(a_style);
  v_colour = u_colours[s];
  v_along = a_along;
  v_style = s;
  vec2 clip = toClip(a_pos) + vec2(a_normal.x, -a_normal.y) * u_widths[s] * u_pixel;
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
uniform float u_sizes[3]; // device pixels
uniform float u_maxRank;
uniform vec2 u_pixel;
out vec2 v_local;
flat out int v_kind;
flat out float v_variant;
flat out float v_size;
void main() {
  int k = int(a_kind);
  float size = a_rank > u_maxRank ? 0.0 : u_sizes[k] * (0.85 + a_variant * 0.12);
  v_local = a_corner;
  v_kind = k;
  v_variant = a_variant;
  v_size = size;
  gl_Position = vec4(toClip(a_pos) + a_corner * 0.5 * size * u_pixel * vec2(1.0, -1.0), 0.0, 1.0);
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
    // A peak: an inked triangle, its eastern face hatched.
    float lean = (v_variant - 1.0) * 0.12;
    vec2 a = vec2(lean, -0.9), b = vec2(-0.92, 0.75), d = vec2(0.92, 0.75);
    float t = sdTriangle(p, a, b, d);
    float body = fill(t, aa);
    float hatch = stroke(fract((p.x - p.y * 0.6) * 3.2) - 0.5, 0.12, 0.08) * step(lean, p.x) * body;
    c = vec4(u_paper, body);
    c = mix(c, vec4(u_ink, 1.0), max(stroke(t, w, aa) * step(p.y, 0.74), hatch * 0.8));
  } else {
    // A hill: a low arc with a tick of shading.
    float arc = length(p - vec2(0.0, 0.7)) - 0.8;
    float upper = step(p.y, 0.6);
    float shade = stroke(p.x - 0.35 - (p.y - 0.2) * 0.3, 0.05, aa) * step(0.0, -arc) * step(0.15, p.y) * upper;
    c = vec4(u_ink, max(stroke(arc, w, aa) * upper, shade * 0.7));
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
uniform sampler2D u_sprites;
uniform sampler2D u_font;
uniform vec2 u_spriteSize;
uniform vec2 u_fontSize;
uniform vec3 u_ink;
out vec4 colour;
void main() {
  if (v_mode == 0) {
    vec4 t = texture(u_sprites, v_uv / u_spriteSize);
    if (t.a < 0.5) discard;
    colour = t;
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
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
  };
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
  private readonly spriteSize: [number, number];
  private readonly fontSize: [number, number];
  private readonly lineStyles: string[];

  constructor(
    canvas: HTMLCanvasElement,
    bundle: GeographyBundle,
    font: SdfFont,
    sprites: TexImageSource & { height: number; width: number }
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
      data: Float32Array,
      usage: GLenum = gl.STATIC_DRAW
    ): WebGLBuffer => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      return b;
    };
    const attribs = (
      layout: [number, number][],
      stride: number,
      divisor = 0
    ): void => {
      let offset = 0;
      layout.forEach(([location, size]) => {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          size,
          gl.FLOAT,
          false,
          stride * 4,
          offset * 4
        );
        gl.vertexAttribDivisor(location, divisor);
        offset += size;
      });
    };

    this.fill = {
      count: bundle.fill.count,
      program: compile(gl, FILL_VS, FILL_FS),
      vao: vao(() => {
        upload(bundle.fill.data);
        attribs(
          [
            [0, 2],
            [1, 1]
          ],
          3
        );
      })
    };
    this.lines = {
      count: bundle.lines.count,
      program: compile(gl, LINE_VS, LINE_FS),
      vao: vao(() => {
        upload(bundle.lines.data);
        attribs(
          [
            [0, 2],
            [1, 2],
            [2, 1],
            [3, 1]
          ],
          6
        );
      })
    };
    this.symbols = {
      count: bundle.symbols.count,
      program: compile(gl, SYMBOL_VS, SYMBOL_FS),
      vao: vao(() => {
        upload(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
        attribs([[0, 2]], 2);
        upload(bundle.symbols.data);
        attribs(
          [
            [1, 2],
            [2, 1],
            [3, 1],
            [4, 1]
          ],
          5,
          1
        );
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
    // The sprites are pixel art: sampled nearest, never smoothed.
    texture(
      0,
      () =>
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          sprites
        ),
      gl.NEAREST
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
    this.spriteSize = [sprites.width, sprites.height];
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
      return name => gl.getUniformLocation(program, name);
    };

    let u = set(this.fill.program);
    gl.uniform3fv(
      u('u_colours'),
      ['water', 'plain', 'forest', 'hill', 'mountain', 'river'].flatMap(k =>
        hex(REGION_COLOURS[k]!)
      )
    );
    gl.uniform1f(u('u_zoom'), view.zoom);
    gl.bindVertexArray(this.fill.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.fill.count);

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
    gl.uniform2f(u('u_pixel'), ...pixel);
    gl.bindVertexArray(this.lines.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.lines.count);

    u = set(this.symbols.program);
    gl.uniform1fv(
      u('u_sizes'),
      SYMBOL_SIZE.map(
        size =>
          Math.min(30, Math.max(5, size * view.zoom)) * view.devicePixelRatio
      )
    );
    gl.uniform1f(u('u_maxRank'), maxRank);
    gl.uniform2f(u('u_pixel'), ...pixel);
    gl.uniform3f(u('u_ink'), ...hex(INK));
    gl.uniform3f(u('u_paper'), ...hex('#efe4c8'));
    gl.uniform3f(u('u_leaf'), ...hex('#b9bf86'));
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
    gl.uniform1i(u('u_sprites'), 0);
    gl.uniform1i(u('u_font'), 1);
    gl.uniform2f(u('u_spriteSize'), ...this.spriteSize);
    gl.uniform2f(u('u_fontSize'), ...this.fontSize);
    gl.uniform3f(u('u_ink'), ...hex(INK));
    gl.bindVertexArray(this.screen.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.screen.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, quads.length * 6);
  }
}
