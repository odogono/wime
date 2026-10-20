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

// Parse a TextFont at offset tf in data. Its pointers are turned into
// offsets in data by toOffset: a disk font's are relative to its hunk, a
// ROM font's are absolute addresses in the ROM.
const parseTextFont = (
  data: Uint8Array,
  tf: number,
  toOffset: (pointer: number) => number,
  name: string,
  source: string
): DiskFont => {
  const height = beU16(data, tf + 20);
  const flags = data[tf + 23]!;
  const xSize = beU16(data, tf + 24);
  const baseline = beU16(data, tf + 26);
  const loChar = data[tf + 32]!;
  const hiChar = data[tf + 33]!;
  const charData = toOffset(beU32(data, tf + 34));
  const modulo = beU16(data, tf + 38);
  const charLoc = toOffset(beU32(data, tf + 40));
  const spacePointer = beU32(data, tf + 44);
  const kernPointer = beU32(data, tf + 48);
  const proportional = (flags & 0x20) !== 0;

  // hiChar - loChar + 1 glyphs, then the "not defined" glyph.
  const count = hiChar - loChar + 2;
  const glyphs: FontGlyph[] = Array.from({ length: count }, (_, i) => {
    const location = beU32(data, charLoc + i * 4);
    return {
      code: i < count - 1 ? loChar + i : null,
      kern: kernPointer === 0 ? 0 : beS16(data, toOffset(kernPointer) + i * 2),
      space:
        proportional && spacePointer !== 0
          ? beS16(data, toOffset(spacePointer) + i * 2)
          : xSize,
      width: location & 0xff_ff,
      x: location >>> 16
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
      source,
      strikeWidth
    },
    strike
  };
};

// Parse a disk font's size file (the load file under FONTS:<name>/).
export const parseDiskFont = (file: Uint8Array, name: string): DiskFont => {
  const hunk = parseHunkFile(file)[0];
  if (!hunk) {
    throw new ExtractError(`${name} has no hunks`);
  }
  if (beU16(hunk.data, DFH_OFFSET + 14) !== DFH_ID) {
    throw new ExtractError(`${name} is not a disk font (no DFH_ID)`);
  }
  return parseTextFont(
    hunk.data,
    TEXT_FONT_OFFSET,
    pointer => pointer,
    name,
    `FONTS:${name} on Disk.1`
  );
};

// topaz/8 in a Kickstart ROM (finding:ui-text-font-lord-10). Kickstart 1.3
// leaves the TextFont's name unset, so it is found by its shape: 8 by 8,
// baseline 6, characters 32 to 255, flags ROMFONT and DESIGNED.
export const parseRomTopaz = (rom: Uint8Array, source: string): DiskFont => {
  const base = rom.length === 0x4_00_00 ? 0xfc_00_00 : 0xf8_00_00;
  for (let tf = 0; tf + 52 < rom.length; tf += 2) {
    if (
      beU16(rom, tf + 20) === 8 &&
      rom[tf + 23] === 0x41 &&
      beU16(rom, tf + 24) === 8 &&
      beU16(rom, tf + 26) === 6 &&
      rom[tf + 32] === 32 &&
      rom[tf + 33] === 255
    ) {
      return parseTextFont(
        rom,
        tf,
        pointer => pointer - base,
        'topaz/8',
        source
      );
    }
  }
  throw new ExtractError(`no topaz/8 TextFont in ${source}`);
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
