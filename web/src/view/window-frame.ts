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

// A remastered window keeps the original's burnt parchment: its frame
// tiles, each colour traced smoothly at SHEET_SCALE times the size and
// recoloured in the Atlas map's inks, lightest to darkest. Colour 0
// stays clear, so the burns still go right through.
const SHEET_SCALE = 8;
const SHEET_INKS = ['#f1e6c8', '#dcc39a', '#9a7a62', '#5e5249'];

const smoothSheets = new WeakMap<CanvasImageSource, HTMLCanvasElement>();

const luminance = (rgb: number): number =>
  0.3 * (rgb >> 16) + 0.59 * ((rgb >> 8) & 0xff) + 0.11 * (rgb & 0xff);

// How much of a hi-res pixel a mask covers: the mask blurred by a
// Gaussian SHEET_BLUR pixels wide, within its tile so no tile bleeds
// into the next, then cut at a soft threshold. Blurring before the cut
// rounds the original's pixel steps into curves.
const SHEET_BLUR = 0.65;

const coverage = (
  mask: Uint8Array,
  width: number,
  u: number,
  v: number
): number => {
  const top =
    Math.floor(v / (SHEET_SCALE * FRAME_TILE_HEIGHT)) * FRAME_TILE_HEIGHT;
  const bottom = top + FRAME_TILE_HEIGHT - 1;
  const sx = (u + 0.5) / SHEET_SCALE - 0.5;
  const sy = (v + 0.5) / SHEET_SCALE - 0.5;
  let sum = 0;
  let weights = 0;
  for (let y = Math.floor(sy) - 1; y <= Math.ceil(sy) + 1; y++) {
    for (let x = Math.floor(sx) - 1; x <= Math.ceil(sx) + 1; x++) {
      const weight = Math.exp(
        -((x - sx) ** 2 + (y - sy) ** 2) / (2 * SHEET_BLUR ** 2)
      );
      const cx = Math.min(Math.max(x, 0), width - 1);
      const cy = Math.min(Math.max(y, top), bottom);
      sum += mask[cy * width + cx]! * weight;
      weights += weight;
    }
  }
  return Math.min(Math.max((sum / weights - 0.38) / 0.12, 0), 1);
};

const smoothSheet = (tiles: CanvasImageSource): HTMLCanvasElement => {
  const cached = smoothSheets.get(tiles);
  if (cached) {
    return cached;
  }
  const width = FRAME_TILE_WIDTH;
  const height = Number((tiles as { height: number }).height);
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext('2d')!;
  sourceCtx.drawImage(tiles, 0, 0);
  const pixels = sourceCtx.getImageData(0, 0, width, height).data;
  const colourAt = (i: number): number | null =>
    pixels[i * 4 + 3]! < 128
      ? null
      : (pixels[i * 4]! << 16) | (pixels[i * 4 + 1]! << 8) | pixels[i * 4 + 2]!;
  const colours = [
    ...new Set(
      Array.from({ length: width * height }, (_, i) => colourAt(i)).filter(
        (c): c is number => c !== null
      )
    )
  ].sort((a, b) => luminance(b) - luminance(a));
  // Each layer covers its colour and every darker one, so they stack.
  const masks = colours.map((_, rank) =>
    Uint8Array.from({ length: width * height }, (_, i) => {
      const c = colourAt(i);
      return c !== null && colours.indexOf(c) >= rank ? 1 : 0;
    })
  );
  const sheet = document.createElement('canvas');
  sheet.width = width * SHEET_SCALE;
  sheet.height = height * SHEET_SCALE;
  const sheetCtx = sheet.getContext('2d')!;
  const out = sheetCtx.createImageData(sheet.width, sheet.height);
  const inks = colours.map((_, rank) => {
    const hex = SHEET_INKS[Math.min(rank, SHEET_INKS.length - 1)]!;
    return [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  });
  for (let v = 0; v < sheet.height; v++) {
    for (let u = 0; u < sheet.width; u++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [rank, mask] of masks.entries()) {
        const cover = coverage(mask, width, u, v);
        if (cover > 0) {
          const [ir, ig, ib] = inks[rank]!;
          r = r * (1 - cover) + ir! * cover;
          g = g * (1 - cover) + ig! * cover;
          b = b * (1 - cover) + ib! * cover;
          a = rank === 0 ? cover : a;
        }
      }
      const o = (v * sheet.width + u) * 4;
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = a * 255;
    }
  }
  sheetCtx.putImageData(out, 0, 0);
  smoothSheets.set(tiles, sheet);
  return sheet;
};

// Draw the window's frame and parchment. Returns the box as fitted to
// the tiles.
export const drawWindowFrame = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  box: Box
): Box => {
  const fitted = frameBox(box);
  const remastered = remasteredAs(ctx) !== undefined;
  const tiles = remastered ? smoothSheet(style.tiles) : style.tiles;
  const tileScale = remastered ? SHEET_SCALE : 1;
  const fill = remastered ? SHEET_INKS[0]! : style.colours.fill;
  const line = remastered ? SHEET_INKS[2]! : style.colours.line;
  ctx.save();
  ctx.imageSmoothingEnabled = remastered;
  const { height, width, x, y } = fitted;
  ctx.fillStyle = fill;
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
      ctx.fillStyle = fill;
      ctx.fillRect(px, py, FRAME_TILE_WIDTH, FRAME_TILE_HEIGHT);
      ctx.fillStyle = line;
      ctx.fillRect(px, py + piece.lineY, FRAME_TILE_WIDTH, 1);
      continue;
    }
    ctx.save();
    ctx.translate(piece.mirrored ? px + FRAME_TILE_WIDTH : px, py);
    if (piece.mirrored) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      tiles,
      0,
      piece.tile * FRAME_TILE_HEIGHT * tileScale,
      FRAME_TILE_WIDTH * tileScale,
      FRAME_TILE_HEIGHT * tileScale,
      0,
      0,
      FRAME_TILE_WIDTH,
      FRAME_TILE_HEIGHT
    );
    ctx.restore();
  }
  ctx.restore();
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
