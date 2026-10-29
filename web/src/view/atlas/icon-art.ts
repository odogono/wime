// The icon columns redrawn as vector art for the Atlas map, inked in its
// style after Tolkien's own maps so they sit with its forests, rivers and
// roads, and stay sharp at the window's resolution. Each fills the
// original's box: native pixels for the Campaign Level, and for the Full
// Map Level its hi-res box at half width, as a hi-res pixel is half as
// wide (docs/spec/atlas-map.md). Both Levels share the drawings.

// One shape of an icon, painted in order: filled, then stroked. A `clip`
// keeps it inside that path, as an iris inside its eye.
interface Part {
  cap?: CanvasLineCap;
  clip?: string;
  d: string;
  dash?: number[];
  fill?: string;
  stroke?: string;
  width?: number;
}

type Art = Part[];

// The Atlas map's inks.
const INK = '#3b2a1e';
const PAPER = '#f1e6c8';
const TAN = '#d9c49a';
const SAGE = '#b7bc8a';
const OLIVE = '#5d6b3a';
const SLATE = '#5b7486';
const BRICK = '#a63c30';
const WOOD = '#8a5a34';
// The outline every icon is inked with, in native pixels.
const LINE = 0.85;

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

const roundRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string =>
  `M${x + r} ${y} h${w - 2 * r} q${r} 0 ${r} ${r} v${h - 2 * r} q0 ${r} ${-r} ${r} h${-(w - 2 * r)} q${-r} 0 ${-r} ${-r} v${-(h - 2 * r)} q0 ${-r} ${r} ${-r} Z`;

const inked = (d: string, fill: string, width = LINE): Part => ({
  d,
  fill,
  stroke: INK,
  width
});
const line = (d: string, width = LINE * 0.7): Part => ({
  cap: 'round',
  d,
  stroke: INK,
  width
});

// The eye, Galadriel's Mirror: an almond with a sage iris and slit pupil,
// lashes all round.
const eye = (w: number, h: number): Art => {
  const cx = w / 2;
  const cy = h / 2;
  const half = w / 2 - 0.6;
  const bulge = h * 0.62;
  const white = `M${cx - half} ${cy} Q${cx} ${cy - bulge} ${cx + half} ${cy} Q${cx} ${cy + bulge} ${cx - half} ${cy} Z`;
  const r = h * 0.29;
  const lashes = [-0.62, -0.36, -0.12, 0.12, 0.36, 0.62]
    .flatMap(t => {
      const x = cx + t * half * 1.25;
      const reach = (1 - Math.abs(t)) * bulge * 0.5;
      const spread = t * 0.9;
      return [
        `M${x} ${cy - reach} l${spread} ${-h * 0.14}`,
        `M${x} ${cy + reach} l${spread} ${h * 0.14}`
      ];
    })
    .join(' ');
  return [
    line(lashes, LINE * 0.6),
    inked(white, PAPER),
    {
      clip: white,
      d: circle(cx, cy, r),
      fill: SAGE,
      stroke: OLIVE,
      width: 0.6
    },
    { clip: white, d: circle(cx, cy, r), stroke: INK, width: LINE * 0.7 },
    {
      d: `M${cx} ${cy - r * 0.85} Q${cx + r * 0.32} ${cy} ${cx} ${cy + r * 0.85} Q${cx - r * 0.32} ${cy} ${cx} ${cy - r * 0.85} Z`,
      fill: INK
    }
  ];
};

// The map, up to the Full Map Level: a folded sheet with a sea to the
// west, mountains, a road and a red cross.
const map = (w: number, h: number): Art => {
  const sheet = `M1 1.6 L${w * 0.5} 1 L${w - 1} 1.6 L${w - 1.2} ${h - 1.4} L${w * 0.5} ${h - 1} L1.2 ${h - 1.4} Z`;
  const sea = `M0 0 L${w * 0.28} 0 Q${w * 0.2} ${h * 0.3} ${w * 0.36} ${h * 0.45} Q${w * 0.5} ${h * 0.6} ${w * 0.46} ${h} L0 ${h} Z`;
  const coast = `M${w * 0.28} 0 Q${w * 0.2} ${h * 0.3} ${w * 0.36} ${h * 0.45} Q${w * 0.5} ${h * 0.6} ${w * 0.46} ${h}`;
  const mx = w * 0.7;
  const my = h * 0.38;
  return [
    inked(sheet, TAN),
    { clip: sheet, d: coast, stroke: SAGE, width: 2.2 },
    { clip: sheet, d: sea, fill: SLATE },
    { clip: sheet, d: coast, stroke: INK, width: LINE * 0.6 },
    line(`M${w * 0.5} 1 L${w * 0.5} ${h - 1}`, 0.4),
    line(
      `M${mx - 2.6} ${my + 1.4} L${mx - 1.2} ${my - 1.2} L${mx + 0.2} ${my + 1.4} M${mx - 0.6} ${my + 1.4} L${mx + 1} ${my - 0.8} L${mx + 2.4} ${my + 1.4}`
    ),
    {
      d: `M${w * 0.42} ${h * 0.2} Q${w * 0.48} ${h * 0.5} ${w * 0.66} ${h * 0.62}`,
      dash: [0.8, 0.7],
      stroke: INK,
      width: 0.5
    },
    {
      cap: 'round',
      d: `M${w * 0.72} ${h * 0.6} l2.2 2.2 M${w * 0.72 + 2.2} ${h * 0.6} l-2.2 2.2`,
      stroke: BRICK,
      width: 1
    }
  ];
};

// The magnifying glass: a slate lens in a wooden rim, the handle to the
// lower left.
const magnifier = (w: number, h: number): Art => {
  const r = Math.min(w, h) * 0.3;
  const cx = w - r - 1.2;
  const cy = r + 1.2;
  const reach = r + 0.8;
  const nx = cx - reach * Math.SQRT1_2;
  const ny = cy + reach * Math.SQRT1_2;
  const handle = `M${nx} ${ny} L1.8 ${h - 1.8}`;
  return [
    { cap: 'round', d: handle, stroke: INK, width: 3.4 },
    { cap: 'round', d: handle, stroke: WOOD, width: 1.8 },
    inked(circle(cx, cy, r + 0.9), TAN),
    inked(circle(cx, cy, r - 0.2), SLATE),
    {
      cap: 'round',
      d: `M${cx - r * 0.55} ${cy - r * 0.05} Q${cx - r * 0.5} ${cy - r * 0.5} ${cx - r * 0.05} ${cy - r * 0.58}`,
      stroke: PAPER,
      width: 0.7
    }
  ];
};

// The hourglass, Game Speed: glass on a wooden stand, sand running.
const hourglass = (w: number, h: number): Art => {
  const cx = w / 2;
  const plate = 1.6;
  const top = 0.8;
  const bottom = h - 0.8;
  const g0 = top + plate;
  const g1 = bottom - plate;
  const mid = (g0 + g1) / 2;
  const gw = w * 0.3;
  const glass = `M${cx - gw} ${g0} Q${cx - gw} ${mid - 1} ${cx - 0.5} ${mid} Q${cx - gw} ${mid + 1} ${cx - gw} ${g1} L${cx + gw} ${g1} Q${cx + gw} ${mid + 1} ${cx + 0.5} ${mid} Q${cx + gw} ${mid - 1} ${cx + gw} ${g0} Z`;
  const post = (x: number): Part =>
    inked(roundRect(x - 0.55, g0 - 0.2, 1.1, g1 - g0 + 0.4, 0.4), WOOD, 0.6);
  return [
    post(1.5),
    post(w - 1.5),
    inked(glass, PAPER, 0.6),
    {
      clip: glass,
      d: `M0 ${g0 + (mid - g0) * 0.4} H${w} V${mid} H0 Z`,
      fill: TAN
    },
    {
      clip: glass,
      d: `M${cx - gw} ${g1} Q${cx} ${g1 - (g1 - mid) * 0.9} ${cx + gw} ${g1} Z`,
      fill: TAN
    },
    {
      d: `M${cx} ${mid} L${cx} ${g1 - 1}`,
      dash: [0.4, 0.5],
      stroke: WOOD,
      width: 0.4
    },
    { clip: glass, d: glass, stroke: INK, width: 0.6 },
    inked(roundRect(0.4, top, w - 0.8, plate, 0.6), WOOD, 0.7),
    inked(roundRect(0.4, bottom - plate, w - 0.8, plate, 0.6), WOOD, 0.7)
  ];
};

// The arrow, Orders: a broad olive arrow, its shaft hatched.
const arrow = (w: number, h: number): Art => {
  const cy = h / 2;
  const shaft = h * 0.2;
  const neck = w * 0.52;
  const d = `M1 ${cy - shaft} L${neck} ${cy - shaft} L${neck} 1 L${w - 1} ${cy} L${neck} ${h - 1} L${neck} ${cy + shaft} L1 ${cy + shaft} Z`;
  return [
    inked(d, OLIVE),
    line(
      `M2.6 ${cy - shaft * 0.4} h${neck * 0.45} M4 ${cy + shaft * 0.35} h${neck * 0.5}`,
      0.35
    )
  ];
};

// The scroll, the Archive: a sheet curled at either end, with wavy lines
// of writing.
const scroll = (w: number, h: number): Art => {
  const left = 2.2;
  const right = w - 2.2;
  const top = 2.4;
  const bottom = h - 2.4;
  const curl = (x: number, y: number, dir: number): Art => [
    inked(circle(x, y, 1.7), TAN, 0.7),
    line(
      `M${x + dir * 0.9} ${y} a0.9 0.9 0 1 ${dir > 0 ? 0 : 1} ${-dir * 1.2} 0.4`,
      0.5
    )
  ];
  const lines = [0.32, 0.5, 0.68]
    .map(t => {
      const y = top + (bottom - top) * t;
      const x0 = left + 2.6;
      const x1 = right - 2.6;
      const step = (x1 - x0) / 4;
      return `M${x0} ${y} q${step / 2} -0.8 ${step} 0 t${step} 0 t${step} 0 t${step} 0`;
    })
    .join(' ');
  return [
    inked(
      `M${left} ${top} Q${w / 2} ${top - 0.8} ${right} ${top} L${right} ${bottom} Q${w / 2} ${bottom + 0.8} ${left} ${bottom} Z`,
      PAPER
    ),
    line(lines, 0.55),
    ...curl(right, top, 1),
    ...curl(left, bottom, -1)
  ];
};

export const CAMPAIGN_ICON_ART: Record<string, Art> = {
  arrow: arrow(19, 14),
  eye: eye(21, 12),
  hourglass: hourglass(16, 16),
  'magnifying-glass': magnifier(19, 18),
  map: map(20, 16)
};

export const FULL_MAP_ICON_ART: Record<string, Art> = {
  eye: eye(20, 10),
  hourglass: hourglass(11, 14),
  'magnifying-glass': magnifier(15.5, 15),
  scroll: scroll(17.5, 16)
};

// The shadow every icon casts to the lower right, as the original's
// Full Map icons do: the map's ink thinned over its parchment, and how
// far it falls in native pixels.
const SHADOW = '#b9ac92';
const SHADOW_OFFSET = 1;

const drawParts = (
  ctx: CanvasRenderingContext2D,
  art: Art,
  x: number,
  y: number,
  scaleX: number,
  // One colour for every part, for the shadow.
  tint?: string
): void => {
  for (const part of art) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);
    if (part.clip) {
      ctx.clip(new Path2D(part.clip));
    }
    const path = new Path2D(part.d);
    if (part.fill) {
      ctx.fillStyle = tint ?? part.fill;
      ctx.fill(path);
    }
    if (part.stroke) {
      ctx.strokeStyle = tint ?? part.stroke;
      ctx.lineWidth = part.width ?? 1;
      ctx.lineCap = part.cap ?? 'butt';
      ctx.lineJoin = 'round';
      ctx.setLineDash(part.dash ?? []);
      ctx.stroke(path);
    }
    ctx.restore();
  }
};

// Draw an icon and its shadow with its box's top left at (x, y), in the
// context's current units, scaled across by `scaleX`. A pressed icon is
// pushed down onto its shadow, which stays put.
export const drawIconArt = (
  ctx: CanvasRenderingContext2D,
  art: Art,
  x: number,
  y: number,
  { pressed = false, scaleX = 1 }: { pressed?: boolean; scaleX?: number } = {}
): void => {
  const shadowX = x + SHADOW_OFFSET * scaleX;
  const shadowY = y + SHADOW_OFFSET;
  drawParts(ctx, art, shadowX, shadowY, scaleX, SHADOW);
  if (pressed) {
    drawParts(ctx, art, shadowX, shadowY, scaleX);
  } else {
    drawParts(ctx, art, x, y, scaleX);
  }
};
