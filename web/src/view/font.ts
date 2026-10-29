// The game's lettering: the disk font lord/10, drawn from its exported
// glyph sheet at whole native pixels (finding:ui-text-font-lord-10,
// finding:data-formats-lord-font-metrics). Measuring and wrapping need
// only the metrics, so they run headless; drawing needs the sheet.
//
// The original letters the hi-res Full Map Level in the ROM font topaz/8,
// which `bun run export:web` takes from a Kickstart 1.3 ROM when there is
// one, and otherwise our own font in its spirit (topaz-alt.ts).

import { LETTERING_FAMILY, atlasInk, remasteredAs } from './remaster';

export interface FontGlyph {
  // The character code, or null for the "not defined" glyph.
  code: number | null;
  // Pen offset before the glyph, in pixels.
  kern: number;
  // Pen advance after the glyph, in pixels.
  space: number;
  // The glyph's columns in the sheet.
  width: number;
  x: number;
}

// The JSON `bun run export:web` writes beside the sheet.
export interface FontMetrics {
  baseline: number;
  glyphs: FontGlyph[];
  height: number;
  hiChar: number;
  loChar: number;
}

export interface Font {
  metrics: FontMetrics;
  // The strike: set pixels white, the rest clear.
  sheet: CanvasImageSource;
}

// Characters outside loChar..hiChar take the last, "not defined", glyph,
// as the graphics library's Text does.
const glyphFor = (metrics: FontMetrics, char: string): FontGlyph => {
  const code = char.charCodeAt(0);
  const glyphs = metrics.glyphs;
  return code >= metrics.loChar && code <= metrics.hiChar
    ? glyphs[code - metrics.loChar]!
    : glyphs.at(-1)!;
};

// The width of one line in pixels: the sum of each glyph's kern and
// advance, as TextLength measures it.
export const measureText = (metrics: FontMetrics, text: string): number => {
  let width = 0;
  for (const char of text) {
    const glyph = glyphFor(metrics, char);
    width += glyph.kern + glyph.space;
  }
  return width;
};

// The widest of several lines.
export const measureLines = (
  metrics: FontMetrics,
  lines: readonly string[]
): number => Math.max(0, ...lines.map(line => measureText(metrics, line)));

// Break text into lines no wider than maxWidth, at spaces and at the
// text's own line breaks. A word wider than maxWidth gets a line of its
// own rather than being split.
export const wrapText = (
  metrics: FontMetrics,
  text: string,
  maxWidth: number
): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measureText(metrics, candidate) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  // Drop the empty line a trailing break leaves, but keep blank lines
  // between paragraphs.
  while (lines.length > 1 && lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
};

// The sheet recoloured once per colour: the glyphs' shapes in that colour.
const tinted = new WeakMap<object, Map<string, HTMLCanvasElement>>();

const sheetIn = (font: Font, colour: string): CanvasImageSource => {
  let byColour = tinted.get(font);
  if (!byColour) {
    byColour = new Map();
    tinted.set(font, byColour);
  }
  let sheet = byColour.get(colour);
  if (!sheet) {
    const { height, width } = font.sheet as { height: number; width: number };
    sheet = document.createElement('canvas');
    sheet.width = width;
    sheet.height = height;
    const ctx = sheet.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D is not available');
    }
    ctx.drawImage(font.sheet, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, width, height);
    byColour.set(colour, sheet);
  }
  return sheet;
};

// A remastered context's lettering: each line in the book face, its
// baseline on the pixel font's, and squeezed if it would run past the
// pixel font's width, so wrapping and alignment stay the original's.
const drawBookText = (
  ctx: CanvasRenderingContext2D,
  font: Font,
  text: string,
  x: number,
  y: number,
  colour: string,
  widthScale: number,
  unitsAcross: number
): number => {
  const { baseline, height } = font.metrics;
  let widest = 0;
  ctx.save();
  ctx.fillStyle = atlasInk(colour);
  ctx.font = `${baseline * BOOK_SIZE_PER_BASELINE}px "${LETTERING_FAMILY}", serif`;
  ctx.textBaseline = 'alphabetic';
  // One unit across to a native pixel, so the face is never stretched.
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(unitsAcross, 1);
  text.split(/\r\n|\r|\n/).forEach((line, row) => {
    const width = measureText(font.metrics, line) * widthScale;
    widest = Math.max(widest, width);
    if (line.trim() !== '') {
      ctx.fillText(line, 0, row * height + baseline, width / unitsAcross);
    }
  });
  ctx.restore();
  return widest;
};

// The book face's size to the pixel font's baseline, so their capitals
// stand about as tall.
const BOOK_SIZE_PER_BASELINE = 1.5;

// Draw text with its top left at (x, y), as the original's text routine
// is called: each line break moves down by the font's height. Returns the
// width of the widest line. A widthScale of 2 draws each pixel two wide,
// for the hi-res Full Map Level.
export const drawText = (
  ctx: CanvasRenderingContext2D,
  font: Font,
  text: string,
  x: number,
  y: number,
  colour: string,
  widthScale = 1
): number => {
  const remastered = remasteredAs(ctx);
  if (remastered) {
    return drawBookText(
      ctx,
      font,
      text,
      x,
      y,
      colour,
      widthScale,
      remastered.unitsAcross
    );
  }
  const sheet = sheetIn(font, colour);
  const { height } = font.metrics;
  let widest = 0;
  text.split(/\r\n|\r|\n/).forEach((line, row) => {
    let pen = Math.round(x);
    const top = Math.round(y) + row * height;
    for (const char of line) {
      const glyph = glyphFor(font.metrics, char);
      pen += glyph.kern * widthScale;
      if (glyph.width > 0) {
        ctx.drawImage(
          sheet,
          glyph.x,
          0,
          glyph.width,
          height,
          pen,
          top,
          glyph.width * widthScale,
          height
        );
      }
      pen += glyph.space * widthScale;
    }
    widest = Math.max(widest, pen - Math.round(x));
  });
  return widest;
};
