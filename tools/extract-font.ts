// Decode the game's text font, lord/10, from Disk 1 of the Reference Build
// (finding:ui-text-font-lord-10, finding:data-formats-lord-font-metrics).
//
// The font is a standard AmigaOS disk font: FONTS:lord/10 is a load file
// whose one hunk holds a DiskFontHeader and its TextFont, followed by the
// strike bitmap and the char location, spacing and kerning tables. The
// browser never parses it (ADR-0001): export-web.ts writes the strike as a
// glyph sheet PNG and the tables as metrics JSON.
import {
  AmigaOFSImage,
  ExtractError,
  RESOURCE_FILES,
  beS16,
  beU16,
  beU32,
  loadLhaMember
} from './extract-graphics';
import { parseHunkFile } from './extract-starting-state';
import type { RgbaImage } from './sheet-font';

// The size file FONTS:lord/10; the OFS reader matches by name only.
export const LORD_FONT_FILE = '10';

// dfh_FileID, the DiskFontHeader's magic.
const DFH_ID = 0x0f_80;
// The DiskFontHeader starts after the hunk's MOVEQ #0,D0 / RTS stub; its
// TextFont follows the 14-byte node, FileID, Revision, Segment and the
// 32-byte name.
const DFH_OFFSET = 4;
const TEXT_FONT_OFFSET = DFH_OFFSET + 14 + 2 + 2 + 4 + 32;

export type FontGlyph = {
  // The character code, or null for the trailing "not defined" glyph.
  code: number | null;
  // Pen offset before drawing (tf_CharKern), in pixels.
  kern: number;
  // Pen advance after drawing (tf_CharSpace), in pixels.
  space: number;
  // The glyph's bits in the strike: x and width in pixels.
  width: number;
  x: number;
};

export type FontMetrics = {
  baseline: number;
  glyphs: FontGlyph[];
  height: number;
  hiChar: number;
  loChar: number;
  name: string;
  source: string;
  strikeWidth: number;
};

export type DiskFont = {
  metrics: FontMetrics;
  // One row per pixel line, each strikeWidth pixels, 1 for a set bit.
  strike: Uint8Array[];
};

// Parse a disk font's size file (the load file under FONTS:<name>/).
export const parseDiskFont = (file: Uint8Array, name: string): DiskFont => {
  const hunk = parseHunkFile(file)[0];
  if (!hunk) {
    throw new ExtractError(`${name} has no hunks`);
  }
  const data = hunk.data;
  if (beU16(data, DFH_OFFSET + 14) !== DFH_ID) {
    throw new ExtractError(`${name} is not a disk font (no DFH_ID)`);
  }
  const tf = TEXT_FONT_OFFSET;
  const height = beU16(data, tf + 20);
  const flags = data[tf + 23]!;
  const xSize = beU16(data, tf + 24);
  const baseline = beU16(data, tf + 26);
  const loChar = data[tf + 32]!;
  const hiChar = data[tf + 33]!;
  const charData = beU32(data, tf + 34);
  const modulo = beU16(data, tf + 38);
  const charLoc = beU32(data, tf + 40);
  const charSpace = beU32(data, tf + 44);
  const charKern = beU32(data, tf + 48);
  const proportional = (flags & 0x20) !== 0;

  // hiChar - loChar + 1 glyphs, then the "not defined" glyph.
  const count = hiChar - loChar + 2;
  const glyphs: FontGlyph[] = Array.from({ length: count }, (_, i) => {
    const location = beU32(data, charLoc + i * 4);
    const x = location >>> 16;
    const width = location & 0xff_ff;
    return {
      code: i < count - 1 ? loChar + i : null,
      kern: charKern === 0 ? 0 : beS16(data, charKern + i * 2),
      space:
        proportional && charSpace !== 0
          ? beS16(data, charSpace + i * 2)
          : xSize,
      width,
      x
    };
  });

  const strikeWidth = modulo * 8;
  const strike = Array.from({ length: height }, (_, row) => {
    const bits = new Uint8Array(strikeWidth);
    for (let x = 0; x < strikeWidth; x++) {
      const byte = data[charData + row * modulo + (x >> 3)]!;
      bits[x] = (byte >> (7 - (x & 7))) & 1;
    }
    return bits;
  });

  return {
    metrics: {
      baseline,
      glyphs,
      height,
      hiChar,
      loChar,
      name,
      source: `FONTS:${name} on Disk.1`,
      strikeWidth
    },
    strike
  };
};

export const loadLordFont = (archive: string): DiskFont => {
  const [diskMember] = RESOURCE_FILES.disk1!;
  const disk = new AmigaOFSImage(loadLhaMember(archive, diskMember));
  return parseDiskFont(disk.readFile(LORD_FONT_FILE), 'lord/10');
};

// The strike as a glyph sheet: set bits white, the rest transparent, so the
// view can colour glyphs from the palette.
export const fontSheet = (font: DiskFont): RgbaImage => {
  const width = font.metrics.strikeWidth;
  const height = font.metrics.height;
  const data = new Uint8Array(width * height * 4);
  font.strike.forEach((row, y) => {
    row.forEach((bit, x) => {
      if (bit) {
        data.set([255, 255, 255, 255], (y * width + x) * 4);
      }
    });
  });
  return { data, height, width };
};
