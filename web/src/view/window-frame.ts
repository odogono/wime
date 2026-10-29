import { drawText, measureLines, type Font } from './font';
import { remasteredAs } from './remaster';

// Every window is framed as the original frames its message box
// (finding:ui-window-frame-tiles): a parchment fill in colour 15 inside
// a ring of 16 by 8 pixel edge tiles, picked at random from AMaps.res
// IMAG 13, or colour 1 inside IMAG 12 on the Animation Level. Colour 0 is clear, so the ragged edge shows what is behind.
// The box is first fitted to the tiles (finding:ui-window-box-geometry).

export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

// A Level's window look: the frame tile sheet in that Level's palette,
// with colour 0 clear, and the colours drawn on the parchment.
export interface WindowStyle {
  colours: {
    // Colour 8: the Good side's header.
    blue: string;
    // Colour 15, or 1 on the Animation Level: the parchment.
    fill: string;
    // Colour 1: the dead and destroyed.
    grey: string;
    // Colour 3, or 27 on the Animation Level: the line along a plain
    // edge piece.
    line: string;
    // Colour 10: the Evil side and the wounded.
    red: string;
    // Colour 5: ordinary lettering, which shows as black.
    text: string;
  };
  // The lettering (finding:ui-text-font-lord-10).
  font: Font;
  // The Full Map Level's hi-res lettering: topaz/8, or our own font in
  // its spirit when no ROM was at hand (topaz-alt.ts).
  hiresFont?: Font;
  tiles: CanvasImageSource;
}

// The palette entries a Level paints the parchment and its plain edge
// line in (finding:ui-window-frame-tiles).
export interface Parchment {
  fill: number;
  line: number;
}

export const MAP_PARCHMENT: Parchment = { fill: 15, line: 3 };
export const ANIMATION_PARCHMENT: Parchment = { fill: 1, line: 27 };

export const windowStyle = (
  tiles: CanvasImageSource,
  palette: readonly string[],
  font: Font,
  parchment: Parchment = MAP_PARCHMENT
): WindowStyle => {
  const colour = (index: number): string => {
    const hex = palette[index];
    if (!hex) {
      throw new Error(`Window palette has no colour ${index}`);
    }
    return hex;
  };
  return {
    colours: {
      blue: colour(8),
      fill: colour(parchment.fill),
      grey: colour(1),
      line: colour(parchment.line),
      red: colour(10),
      text: colour(5)
    },
    font,
    tiles
  };
};

export const FRAME_TILE_WIDTH = 16;
export const FRAME_TILE_HEIGHT = 8;

// The tile sheet's rows, two or four of each kind to choose from. The
// right side uses the left side's tiles, mirrored.
const TOP_CORNERS = 0;
const BOTTOM_CORNERS = 2;
const TOP_EDGES = 4;
const BOTTOM_EDGES = 6;
const SIDE_EDGES = 8;

// The original moves a box right of x 0 onto a multiple of 8, never
// left of 8, and rounds its width up to whole tiles across and its
// height up to whole tiles down (code+0x05cbe). y is kept.
export const frameBox = (box: Box): Box => ({
  height: Math.ceil(box.height / FRAME_TILE_HEIGHT) * FRAME_TILE_HEIGHT,
  width: Math.ceil(box.width / FRAME_TILE_WIDTH) * FRAME_TILE_WIDTH,
  x: box.x > 0 ? box.x & ~7 || 8 : box.x,
  y: box.y
});

export type FramePiece =
  // Tile `tile` of the sheet, at (x, y) within the box.
  | { kind: 'tile'; mirrored: boolean; tile: number; x: number; y: number }
  // A plain stretch of top or bottom edge: parchment with a one-pixel
  // line in colour 3 at row `lineY` of the piece.
  | { kind: 'plain'; lineY: number; x: number; y: number };

// The pieces of a fitted box's frame, in the original's order
// (code+0x05e46 to code+0x0610c). `random(bits)` returns 0 to
// 2^bits - 1, as the original's randomBits.
export const framePieces = (
  width: number,
  height: number,
  random: (bits: number) => number
): FramePiece[] => {
  const across = width / FRAME_TILE_WIDTH - 2;
  const down = height / FRAME_TILE_HEIGHT - 2;
  const right = width - FRAME_TILE_WIDTH;
  const bottom = height - FRAME_TILE_HEIGHT;
  const pieces: FramePiece[] = [];
  const tile = (
    mirrored: boolean,
    index: number,
    x: number,
    y: number
  ): void => {
    pieces.push({ kind: 'tile', mirrored, tile: index, x, y });
  };
  for (const mirrored of [false, true]) {
    const x = mirrored ? right : 0;
    tile(mirrored, TOP_CORNERS + random(1), x, 0);
    tile(mirrored, BOTTOM_CORNERS + random(1), x, bottom);
    for (let i = 0; i < down; i++) {
      tile(mirrored, SIDE_EDGES + random(2), x, (i + 1) * FRAME_TILE_HEIGHT);
    }
  }
  for (const [y, edges, lineY] of [
    [0, TOP_EDGES, 0],
    [bottom, BOTTOM_EDGES, FRAME_TILE_HEIGHT - 1]
  ] as const) {
    for (let i = 0; i < across; i++) {
      const x = (i + 1) * FRAME_TILE_WIDTH;
      // One stretch in four is plain.
      if (random(2) !== 0) {
        const mirrored = random(1) === 1;
        tile(mirrored, edges + random(1), x, y);
      } else {
        pieces.push({ kind: 'plain', lineY, x, y });
      }
    }
  }
  return pieces;
};

// The original draws a box's tiles afresh each time it opens. A window
// here is redrawn every frame, so its picks are seeded from where it is
// and how big, and it keeps one look while open. The generator is the
// original's (code+0x031c2), without the frame counter it mixes in.
export const seededRandom = (box: Box): ((bits: number) => number) => {
  let seed = ((box.x * 31 + box.y) * 31 + box.width) * 31 + box.height + 1;
  return bits => {
    seed = (seed * 125) % 0x2a_aa_ab;
    return seed & ((1 << bits) - 1);
  };
};

// A remastered window is a sheet of parchment torn to the frame's
// ragged outline, inked and shadowed as the Atlas map's icons are.
const TORN_PAPER = '#f1e6c8';
const TORN_INK = '#3b2a1e';
const TORN_SHADOW = '#b9ac92';
// How far in from the fitted box the tear runs, at most, and the length
// of each torn stretch, in native pixels.
const TEAR_DEPTH = 2;
const TEAR_STEP = 4;

// The torn outline of a fitted box, the same each time for the same box.
export const tornOutline = (box: Box): [number, number][] => {
  const random = seededRandom(box);
  const tear = (): number => 0.6 + (random(4) / 15) * (TEAR_DEPTH - 0.6);
  const { height, width, x, y } = box;
  const points: [number, number][] = [];
  const side = (
    from: [number, number],
    to: [number, number],
    inward: [number, number]
  ): void => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.round(length / TEAR_STEP));
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const depth = tear();
      points.push([
        from[0] + (to[0] - from[0]) * t + inward[0] * depth,
        from[1] + (to[1] - from[1]) * t + inward[1] * depth
      ]);
    }
  };
  side([x, y], [x + width, y], [0, 1]);
  side([x + width, y], [x + width, y + height], [-1, 0]);
  side([x + width, y + height], [x, y + height], [0, -1]);
  side([x, y + height], [x, y], [1, 0]);
  return points;
};

const drawTornFrame = (ctx: CanvasRenderingContext2D, fitted: Box): void => {
  // Curved through the midpoints, so the tear is soft, not saw-toothed.
  const points = tornOutline(fitted);
  const mid = (i: number): [number, number] => {
    const [ax, ay] = points[i % points.length]!;
    const [bx, by] = points[(i + 1) % points.length]!;
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  const path = new Path2D();
  path.moveTo(...mid(0));
  for (let i = 1; i <= points.length; i++) {
    const [cx, cy] = points[i % points.length]!;
    path.quadraticCurveTo(cx, cy, ...mid(i));
  }
  path.closePath();
  ctx.save();
  ctx.translate(1, 1);
  ctx.fillStyle = TORN_SHADOW;
  ctx.fill(path);
  ctx.restore();
  ctx.fillStyle = TORN_PAPER;
  ctx.fill(path);
  ctx.strokeStyle = TORN_INK;
  ctx.lineWidth = 0.5;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
};

// Draw the window's frame and parchment. Returns the box as fitted to
// the tiles.
export const drawWindowFrame = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  box: Box
): Box => {
  const fitted = frameBox(box);
  const remastered = remasteredAs(ctx);
  if (remastered) {
    ctx.save();
    ctx.scale(remastered.unitsAcross, 1);
    drawTornFrame(ctx, {
      ...fitted,
      width: fitted.width / remastered.unitsAcross,
      x: fitted.x / remastered.unitsAcross
    });
    ctx.restore();
    return fitted;
  }
  const { height, width, x, y } = fitted;
  ctx.fillStyle = style.colours.fill;
  if (width > 2 * FRAME_TILE_WIDTH && height > 2 * FRAME_TILE_HEIGHT) {
    ctx.fillRect(
      x + FRAME_TILE_WIDTH,
      y + FRAME_TILE_HEIGHT,
      width - 2 * FRAME_TILE_WIDTH,
      height - 2 * FRAME_TILE_HEIGHT
    );
  }
  for (const piece of framePieces(width, height, seededRandom(fitted))) {
    const px = x + piece.x;
    const py = y + piece.y;
    if (piece.kind === 'plain') {
      ctx.fillStyle = style.colours.fill;
      ctx.fillRect(px, py, FRAME_TILE_WIDTH, FRAME_TILE_HEIGHT);
      ctx.fillStyle = style.colours.line;
      ctx.fillRect(px, py + piece.lineY, FRAME_TILE_WIDTH, 1);
      continue;
    }
    ctx.save();
    ctx.translate(piece.mirrored ? px + FRAME_TILE_WIDTH : px, py);
    if (piece.mirrored) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      style.tiles,
      0,
      piece.tile * FRAME_TILE_HEIGHT,
      FRAME_TILE_WIDTH,
      FRAME_TILE_HEIGHT,
      0,
      0,
      FRAME_TILE_WIDTH,
      FRAME_TILE_HEIGHT
    );
    ctx.restore();
  }
  return fitted;
};

// Letter text into a window at (x, y), its top left, in the window's
// ordinary colour unless another is given.
export const windowText = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  text: string,
  x: number,
  y: number,
  colour: string = style.colours.text
): number => drawText(ctx, style.font, text, x, y, colour);

// The same on the hi-res Full Map Level: in the style's hi-res font at
// hi-res pixels, as the original letters it in topaz/8, or with none in
// lord/10 with each pixel drawn two wide (finding:ui-text-font-lord-10).
export const hiresWindowText = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  text: string,
  x: number,
  y: number,
  colour: string = style.colours.text
): number =>
  style.hiresFont
    ? drawText(ctx, style.hiresFont, text, x, y, colour)
    : drawText(ctx, style.font, text, x, y, colour, 2);

// The width of hi-res lines in hi-res pixels, as hiresWindowText draws
// them.
export const measureHiresLines = (
  style: WindowStyle,
  lines: readonly string[]
): number =>
  style.hiresFont
    ? measureLines(style.hiresFont.metrics, lines)
    : 2 * measureLines(style.font.metrics, lines);
