// The icon columns redrawn as vector art for the Atlas map, so they stay
// sharp at the window's resolution as the map does. Each follows the
// original's IMAG in shape and palette, in its box: native pixels for the
// Campaign Level, and for the Full Map Level its hi-res box at half width,
// as a hi-res pixel is half as wide (docs/spec/atlas-map.md).

// One shape of an icon, painted in order: filled, then stroked. A `clip`
// keeps it inside that path, as an iris inside its eye; an `offset`
// moves it, clip and all.
interface Part {
  cap?: CanvasLineCap;
  clip?: string;
  d: string;
  dash?: number[];
  fill?: string;
  offset?: [number, number];
  stroke?: string;
  width?: number;
}

type Art = Part[];

const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

const rect = (x: number, y: number, w: number, h: number): string =>
  `M${x} ${y} h${w} v${h} h${-w} Z`;

// An almond eye from (x0, cy) to (x1, cy), `bulge` above and below.
const almond = (x0: number, x1: number, cy: number, bulge: number): string => {
  const mid = (x0 + x1) / 2;
  return `M${x0} ${cy} Q${mid} ${cy - bulge} ${x1} ${cy} Q${mid} ${cy + bulge} ${x0} ${cy} Z`;
};

// The same parts moved by (dx, dy) and painted in one colour: the brown
// shadow the Full Map Level's icons cast to the lower right.
const shadow = (parts: Art, dx: number, dy: number, colour: string): Art =>
  parts.map(part => ({
    ...part,
    offset: [dx, dy],
    ...(part.fill && { fill: colour }),
    ...(part.stroke && { stroke: colour })
  }));

// Campaign Level, IMAG 26: the green eye with its red and blue iris.
const campaignEye = (): Art => {
  const sclera = almond(2.4, 18.6, 6, 6.6);
  return [
    { d: almond(0.4, 20.6, 6, 8.4), fill: '#003300' },
    { d: sclera, fill: '#00CC00' },
    { clip: sclera, d: circle(10.5, 6, 4.3), fill: '#CC1133' },
    {
      clip: sclera,
      d: circle(10.5, 6, 3.4),
      stroke: '#4488FF',
      width: 1.1
    },
    { clip: sclera, d: circle(10.5, 6, 4.3), stroke: '#003300', width: 0.6 },
    { d: 'M10.5 2 Q12.1 6 10.5 10 Q8.9 6 10.5 2 Z', fill: '#000000' },
    { d: circle(8.7, 4.3, 0.75), fill: '#00DDBB' },
    {
      cap: 'round',
      d: 'M4 7.6 Q10.5 11.6 17 7.6',
      stroke: '#BB9988',
      width: 0.9
    }
  ];
};

// IMAG 27: the hourglass, Game Speed.
const campaignHourglass = (): Art => [
  { d: rect(0.6, 0.6, 14.8, 14.8), fill: '#003300' },
  { d: rect(2, 3, 1.5, 10), fill: '#226611' },
  { d: rect(12.5, 3, 1.5, 10), fill: '#226611' },
  {
    d: 'M4.2 3 L11.8 3 Q11.8 6.6 8.7 8 Q11.8 9.4 11.8 13 L4.2 13 Q4.2 9.4 7.3 8 Q4.2 6.6 4.2 3 Z',
    fill: '#77BBFF',
    stroke: '#444444',
    width: 0.5
  },
  { d: 'M4.8 4 L11.2 4 Q10.8 6.4 8 7.6 Q5.2 6.4 4.8 4 Z', fill: '#FFEEAA' },
  { d: 'M8 7.6 L8 12', stroke: '#FFEEAA', width: 0.5 },
  { d: 'M4.6 12.8 Q8 9.6 11.4 12.8 Z', fill: '#FFEEAA' },
  { d: 'M7 12.8 Q9.5 11 11.4 12.8 Z', fill: '#BB9988' },
  { d: rect(1, 1, 14, 2), fill: '#777777', stroke: '#444444', width: 0.5 },
  { d: rect(1, 13, 14, 2), fill: '#777777', stroke: '#444444', width: 0.5 }
];

// IMAG 28: the magnifying glass.
const campaignMagnifier = (): Art => [
  { cap: 'round', d: 'M2.6 15.4 L8.2 10.8', stroke: '#003300', width: 4.4 },
  { cap: 'round', d: 'M2.6 15.4 L8.2 10.8', stroke: '#00CC00', width: 2.2 },
  { cap: 'round', d: 'M2.9 14.4 L7.6 10.6', stroke: '#777777', width: 0.7 },
  { d: circle(12, 7, 5.4), stroke: '#003300', width: 3.6 },
  { d: circle(12, 7, 5.4), stroke: '#777777', width: 1.6 },
  { d: circle(12, 7, 5.9), stroke: '#00CC00', width: 0.5 },
  {
    cap: 'round',
    d: 'M9.4 6.2 Q10 4.4 11.8 4.1',
    stroke: '#00DDBB',
    width: 1
  }
];

// IMAG 30: the map, up to the Full Map Level.
const campaignMap = (): Art => [
  { d: rect(0.5, 0.5, 19, 15), fill: '#003300' },
  { d: rect(2, 2, 16, 12), fill: '#4488FF' },
  {
    d: 'M6.2 2 L18 2 L18 12.4 Q15.2 14 12.4 12.6 Q10.4 11 8.6 12.4 Q6.4 11.6 7.6 9 Q5.4 7.2 7 5 Q5.4 3.6 6.2 2 Z',
    fill: '#00CC00'
  },
  {
    cap: 'round',
    d: 'M3 4 Q4 3.4 5 4 M3.4 7.6 Q4.6 7 5.6 7.6 M14.6 12.8 Q16 12.4 17.2 13',
    stroke: '#77BBFF',
    width: 0.6
  },
  {
    cap: 'round',
    d: 'M9.4 6.4 L11 4.2 L12.6 6.4 M12.6 9.4 L14.2 7.2 L15.8 9.4',
    stroke: '#777777',
    width: 0.9
  },
  { d: 'M13.2 4.6 Q15 3.4 16.6 4.4', stroke: '#998877', width: 0.7 },
  {
    d: rect(1.25, 1.25, 17.5, 13.5),
    dash: [1, 1],
    stroke: '#00FF00',
    width: 0.6
  },
  {
    cap: 'round',
    d: 'M2.8 11 L5.2 13.4 M5.2 11 L2.8 13.4',
    stroke: '#FF0000',
    width: 1
  }
];

// IMAG 31: the arrow, Orders.
const campaignArrow = (): Art => {
  const arrow = 'M1.2 4.6 L9 4.6 L9 1.2 L17.8 7 L9 12.8 L9 9.4 L1.2 9.4 Z';
  return [
    { d: arrow, fill: '#003300', stroke: '#003300', width: 2 },
    { d: arrow, fill: '#FF0000' },
    {
      cap: 'round',
      d: 'M1.7 8.8 L1.7 5.1 L9.5 5.1 L9.5 2.2',
      stroke: '#998877',
      width: 0.7
    }
  ];
};

// The Full Map Level's icons, cream on the parchment with brown shadows.
const SHADOW = '#775555';
const withShadow = (parts: Art, dx = 1.1, dy = 1): Art => [
  ...shadow(parts, dx, dy, SHADOW),
  ...parts
];

// IMAG 32: the eye, Galadriel's Mirror.
const fullMapEye = (): Art => {
  const white = almond(0.3, 18.7, 4.6, 7.4);
  return withShadow([
    { d: white, fill: '#FFEEBB', stroke: '#223311', width: 0.4 },
    { clip: white, d: circle(9.5, 4.6, 3.4), fill: '#CC1133' },
    { clip: white, d: circle(9.5, 4.6, 2.7), stroke: '#5588FF', width: 0.9 },
    { d: 'M9.5 1.4 Q10.8 4.6 9.5 7.8 Q8.2 4.6 9.5 1.4 Z', fill: '#223311' },
    { d: circle(10.9, 3.2, 0.6), fill: '#00FFFF' }
  ]);
};

// A rolled end of the scroll.
const roll = (x: number): Part => ({
  d: `M${x} 2 Q${x + 1.4} 0.8 ${x + 2.8} 2 L${x + 2.8} 13.4 Q${x + 1.4} 14.6 ${x} 13.4 Z`,
  fill: '#CCAA88',
  stroke: '#555555',
  width: 0.4
});

// IMAG 35: the scroll, the Archive.
const fullMapScroll = (): Art => {
  const lines = [4.8, 7.4, 10]
    .map(y => `M5.4 ${y} h1.2 M7.6 ${y} h2.6 M11 ${y} h2.2`)
    .join(' ');
  return withShadow([
    {
      d: rect(2.6, 2.8, 12, 10),
      fill: '#FFEEBB',
      stroke: '#888888',
      width: 0.4
    },
    roll(0.6),
    roll(14),
    {
      d: 'M1.4 2.6 L1.4 12.8 M14.8 2.6 L14.8 12.8',
      stroke: '#FFEEBB',
      width: 0.6
    },
    { d: lines, stroke: '#223311', width: 0.9 }
  ]);
};

// IMAG 34: the hourglass.
const fullMapHourglass = (): Art =>
  withShadow([
    { d: rect(0.6, 0.6, 9.8, 1.4), fill: '#223311' },
    { d: rect(0.6, 12, 9.8, 1.4), fill: '#223311' },
    { d: rect(1, 2, 1, 10), fill: '#335511' },
    { d: rect(9, 2, 1, 10), fill: '#335511' },
    {
      d: 'M2.6 2 L8.4 2 Q8.4 5.4 6 7 Q8.4 8.6 8.4 12 L2.6 12 Q2.6 8.6 5 7 Q2.6 5.4 2.6 2 Z',
      fill: '#FFEEBB',
      stroke: '#667755',
      width: 0.4
    },
    {
      d: 'M3.2 2.8 L7.8 2.8 Q7.4 5.2 5.5 6.4 Q3.6 5.2 3.2 2.8 Z',
      fill: '#CCAA88'
    },
    { d: 'M3.2 11.6 Q5.5 9 7.8 11.6 Z', fill: '#CCAA88' }
  ]);

// IMAG 33: the magnifying glass, down to the Campaign Level.
const fullMapMagnifier = (): Art =>
  withShadow([
    { cap: 'round', d: 'M1.4 13.4 L6.2 9.6', stroke: '#555555', width: 2.2 },
    { cap: 'round', d: 'M1.4 13.4 L6.2 9.6', stroke: '#888888', width: 0.8 },
    { d: circle(9.6, 6, 4.6), stroke: '#555555', width: 1.6 },
    { d: circle(9.6, 6, 4.6), stroke: '#888888', width: 0.6 }
  ]);

export const CAMPAIGN_ICON_ART: Record<string, Art> = {
  arrow: campaignArrow(),
  eye: campaignEye(),
  hourglass: campaignHourglass(),
  'magnifying-glass': campaignMagnifier(),
  map: campaignMap()
};

export const FULL_MAP_ICON_ART: Record<string, Art> = {
  eye: fullMapEye(),
  hourglass: fullMapHourglass(),
  'magnifying-glass': fullMapMagnifier(),
  scroll: fullMapScroll()
};

// Draw an icon with its box's top left at (x, y), in the context's
// current units, scaled across by `scaleX`.
export const drawIconArt = (
  ctx: CanvasRenderingContext2D,
  art: Art,
  x: number,
  y: number,
  scaleX = 1
): void => {
  for (const part of art) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);
    if (part.offset) {
      ctx.translate(part.offset[0], part.offset[1]);
    }
    if (part.clip) {
      ctx.clip(new Path2D(part.clip));
    }
    const path = new Path2D(part.d);
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(path);
    }
    if (part.stroke) {
      ctx.strokeStyle = part.stroke;
      ctx.lineWidth = part.width ?? 1;
      ctx.lineCap = part.cap ?? 'butt';
      ctx.lineJoin = 'round';
      ctx.setLineDash(part.dash ?? []);
      ctx.stroke(path);
    }
    ctx.restore();
  }
};
