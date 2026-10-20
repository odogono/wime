import { existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { fontSheet, loadLordFont } from './extract-font';
import { DEFAULT_ARCHIVE } from './extract-graphics';

describe.skipIf(!existsSync(DEFAULT_ARCHIVE))('lord/10', () => {
  const font = loadLordFont(DEFAULT_ARCHIVE);
  const glyph = (char: string) =>
    font.metrics.glyphs[char.charCodeAt(0) - font.metrics.loChar]!;

  // finding:data-formats-lord-font-metrics
  test('has the TextFont metrics', () => {
    expect(font.metrics).toMatchObject({
      baseline: 7,
      height: 10,
      hiChar: 126,
      loChar: 32,
      strikeWidth: 256
    });
    expect(font.metrics.glyphs).toHaveLength(96);
    expect(font.metrics.glyphs.every(g => g.kern === 0)).toBe(true);
  });

  test('gives each glyph its width and advance', () => {
    expect(glyph(' ')).toMatchObject({ space: 2, width: 0 });
    expect(glyph('i')).toMatchObject({ space: 2, width: 2 });
    expect(glyph('a')).toMatchObject({ space: 4, width: 3 });
    expect(glyph('M')).toMatchObject({ space: 6, width: 5 });
    expect(glyph('@')).toMatchObject({ space: 7, width: 0 });
    expect(glyph('O').x).toBe(glyph('0').x);
  });

  test('draws the strike as a white sheet on a clear ground', () => {
    const sheet = fontSheet(font);
    expect([sheet.width, sheet.height]).toEqual([256, 10]);
    const alphas = new Set<number>();
    for (let i = 3; i < sheet.data.length; i += 4) {
      alphas.add(sheet.data[i]!);
    }
    expect([...alphas].sort()).toEqual([0, 255]);
  });
});
