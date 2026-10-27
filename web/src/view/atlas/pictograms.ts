// The ink pictures Places are drawn with on the Atlas map, hand-drawn as
// SVG paths in a 64 by 64 box (y down) after the style of Tolkien's maps.
// At load they are drawn and turned into a two-channel distance field:
// red is ink, green is the paper body behind it, so a nearer shape hides
// the lines of one behind it.
import { INF, edt } from './sdf-font';

// One stroke of a picture, painted in order. `body` knocks out the ink
// beneath it and lays paper; `stroke` inks its outline at that width;
// `ink` fills it solid.
interface Part {
  body?: boolean;
  d: string;
  ink?: boolean;
  stroke?: number;
}

// A cottage: walls and a gable roof.
const house = (
  left: number,
  right: number,
  eaves: number,
  ridge: number,
  base: number
): string =>
  `M${left} ${base} L${left} ${eaves} L${(left + right) / 2} ${ridge} L${right} ${eaves} L${right} ${base} Z`;

const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;

const outlined = (d: string, stroke = 2.6): Part => ({ body: true, d, stroke });
const ground = (d: string): Part => ({ d, stroke: 2.2 });

export const PICTOGRAM_ART: Record<string, Part[]> = {
  // Water and stepping stones across it, on the diagonal.
  ford: [
    ground('M2 24 Q11 20 20 24'),
    ground('M44 58 Q53 54 62 58'),
    { d: 'M5 33 h11 M8 50 h12 M42 42 h15 M28 58 h10', stroke: 1.8 },
    ...[
      [16, 44],
      [25, 38],
      [34, 33],
      [43, 28],
      [51, 24]
    ].map(([x, y]) => ({ d: ellipse(x!, y!, 3.6, 2.6), ink: true }))
  ],
  // Two arches under a bowed deck, over water.
  bridge: [
    outlined(
      'M4 38 Q32 28 60 38 V52 H52 V48 A8 8 0 0 0 36 48 V52 H28 V48 A8 8 0 0 0 12 48 V52 H4 Z'
    ),
    { d: 'M14 57 h10 M40 57 h10 M22 61 h20', stroke: 1.8 }
  ],
  // Low curved wall about a cluster of roofs and one tall spire.
  city: [
    outlined('M29 40 V16 L32 4 L35 16 V40 Z'),
    outlined(house(12, 26, 30, 22, 42)),
    outlined(house(38, 52, 30, 22, 42)),
    outlined('M5 40 Q32 49 59 40 V52 Q32 61 5 52 Z'),
    { d: 'M29 57 V51 A3 3 0 0 1 35 51 V57 Z', ink: true },
    ground('M2 58 Q16 55 26 58 M40 58 Q50 55 62 58')
  ],
  // A tall keep between two smaller crenellated towers, on a rise.
  castle: [
    outlined('M24 46 V12 H27 V8 H31 V12 H33 V8 H37 V12 H40 V46 Z'),
    outlined('M17 50 V32 H47 V50 Z'),
    outlined('M9 50 V26 H11 V22 H14 V26 H16 V22 H19 V26 H21 V50 Z'),
    outlined('M43 50 V26 H45 V22 H48 V26 H50 V22 H53 V26 H55 V50 Z'),
    { d: 'M31 18 h2 v6 h-2 Z', ink: true },
    { d: 'M29 50 V44 A3 3 0 0 1 35 44 V50 Z', ink: true },
    ground('M2 57 Q12 49 22 53 Q32 49 42 53 Q52 49 62 57')
  ],
  // A dark spire among lesser spires above a jagged base.
  citadel: [
    { d: 'M10 54 L12 42 L14 35 L16 42 L17 54 Z', ink: true },
    { d: 'M47 54 L48 42 L50 35 L52 42 L54 54 Z', ink: true },
    { d: 'M16 50 L18 30 L20 21 L22 30 L23 50 Z', ink: true },
    { d: 'M41 50 L42 30 L44 21 L46 30 L48 50 Z', ink: true },
    {
      d: 'M27 48 L28 14 L25 4 L30 10 L32 6 L34 10 L39 4 L36 14 L37 48 Z',
      ink: true
    },
    { d: 'M5 60 L14 50 L22 53 L32 46 L42 53 L50 50 L59 60 Z', ink: true }
  ],
  // An elven hall with a pointed door between two slender trees.
  elven: [
    { d: 'M11 54 V28 M53 54 V26', stroke: 2.4 },
    outlined(ellipse(11, 21, 7.5, 9.5)),
    outlined(ellipse(53, 19, 7.5, 10)),
    outlined('M19 54 V37 Q26 35 28 25 L32 15 L36 25 Q38 35 45 37 V54 Z'),
    { d: 'M29 54 V44 Q32 37 35 44 V54 Z', ink: true },
    ground('M3 57 Q32 52 61 57')
  ],
  // A wall between two towers with a great barred arch.
  gate: [
    { d: 'M7 52 V20 H9 V16 H12 V20 H14 V16 H17 V20 H19 V52 Z', ink: true },
    { d: 'M45 52 V20 H47 V16 H50 V20 H52 V16 H55 V20 H57 V52 Z', ink: true },
    { d: 'M19 52 V27 H45 V52 Z', ink: true },
    { body: true, d: 'M24 52 V38 A8 8 0 0 1 40 38 V52 Z' },
    { d: 'M28 52 V33 M32 52 V30 M36 52 V33', stroke: 1.6 },
    ground('M2 57 Q32 53 62 57')
  ],
  // A mountain around a dark door.
  hold: [
    outlined('M3 56 L19 32 L25 35 L34 10 L44 31 L48 29 L61 56 Z'),
    { d: 'M34 10 L30 25 M44 31 L41 38 M19 32 L17 40', stroke: 1.8 },
    outlined('M23 56 V41 L32 34 L41 41 V56 Z'),
    { d: 'M27 56 V43 L32 39 L37 43 V56 Z', ink: true }
  ],
  // Broken walls of uneven height, one keeping its arch.
  ruin: [
    outlined('M7 52 V30 L10 26 L12 31 L15 24 L18 29 V52 Z'),
    outlined(
      'M22 52 V20 L25 13 L28 18 L31 11 L34 19 L39 15 V52 H35 V43 A3 3 0 0 0 29 43 V52 Z'
    ),
    outlined('M44 52 V37 L47 33 L50 39 L54 34 V52 Z'),
    ...[
      [42, 57],
      [50, 56],
      [16, 57]
    ].map(([x, y]) => ({ d: ellipse(x!, y!, 2.4, 1.6), ink: true })),
    ground('M2 55 Q32 52 62 55')
  ],
  // A slender black tower with a forked crown, rising from a crag.
  tower: [
    {
      d: 'M28 50 L29 15 L25 3 L30 10 L32 6 L34 10 L39 3 L35 15 L36 50 Z',
      ink: true
    },
    { body: true, d: 'M31 22 h2 v5 h-2 Z' },
    { d: 'M12 58 L21 49 L28 51 L36 51 L43 47 L52 58 Z', ink: true }
  ],
  // Three cottages, their gables overlapping.
  town: [
    outlined(house(22, 42, 26, 12, 42)),
    outlined(house(6, 29, 35, 22, 53)),
    outlined(house(35, 57, 35, 21, 53)),
    { d: 'M15 53 V45 h5 V53 Z M44 53 V45 h5 V53 Z', ink: true },
    ground('M2 56 Q32 52 62 56')
  ],
  // A cone with an open crater and a curl of smoke.
  volcano: [
    outlined('M5 57 L22 35 L26 22 L38 22 L42 35 L59 57 Z'),
    { d: 'M26 22 Q32 27 38 22 Q32 18 26 22 Z', ink: true },
    { d: 'M28 27 L23 45 M36 27 L41 43', stroke: 1.8 },
    { d: 'M32 19 Q27 13 33 9 Q39 5 34 1', stroke: 2 }
  ]
};

export interface PictogramAtlas {
  // The cell's size in texels, and how much of it is margin either side
  // of the 64-unit box.
  cell: number;
  // Each picture's cell, in texels, by name.
  cells: Map<string, { u: number; v: number }>;
  margin: number;
  texture: { data: Uint8Array; height: number; width: number };
}

const SCALE = 2;
const RADIUS = 8;

// Draw every picture and make its distance field.
export const buildPictogramAtlas = (
  names: readonly string[]
): PictogramAtlas => {
  const art = names.filter(n => PICTOGRAM_ART[n]);
  const margin = RADIUS + 2;
  const cell = 64 * SCALE + margin * 2;
  const columns = Math.ceil(Math.sqrt(art.length));
  const rows = Math.ceil(art.length / columns);
  const width = columns * cell;
  const height = rows * cell;
  const canvas = (): CanvasRenderingContext2D => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c.getContext('2d', { willReadFrequently: true })!;
  };
  const ink = canvas();
  const body = canvas();
  const cells = new Map<string, { u: number; v: number }>();
  art.forEach((name, i) => {
    const u = (i % columns) * cell;
    const v = Math.floor(i / columns) * cell;
    cells.set(name, { u, v });
    for (const ctx of [ink, body]) {
      ctx.setTransform(SCALE, 0, 0, SCALE, u + margin, v + margin);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
    }
    for (const part of PICTOGRAM_ART[name]!) {
      const path = new Path2D(part.d);
      if (part.body) {
        ink.globalCompositeOperation = 'destination-out';
        ink.fill(path);
        ink.globalCompositeOperation = 'source-over';
        body.fill(path);
      }
      if (part.ink) {
        ink.fill(path);
      }
      if (part.stroke) {
        ink.lineWidth = part.stroke;
        ink.stroke(path);
      }
    }
  });
  const field = (ctx: CanvasRenderingContext2D): Uint8Array => {
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const outside = new Float64Array(width * height);
    const inside = new Float64Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const on = pixels[i * 4 + 3]! > 127;
      outside[i] = on ? 0 : INF;
      inside[i] = on ? INF : 0;
    }
    edt(outside, width, height);
    edt(inside, width, height);
    const out = new Uint8Array(width * height);
    for (let i = 0; i < out.length; i++) {
      const signed = outside[i]! - inside[i]!;
      out[i] = Math.max(
        0,
        Math.min(255, Math.round(128 - (signed / RADIUS) * 127))
      );
    }
    return out;
  };
  // The ink also counts as body, so ink lines sit on paper.
  const inkField = field(ink);
  const bodyField = field(body);
  const data = new Uint8Array(width * height * 2);
  for (let i = 0; i < width * height; i++) {
    data[i * 2] = inkField[i]!;
    data[i * 2 + 1] = bodyField[i]!;
  }
  return { cell, cells, margin, texture: { data, height, width } };
};
