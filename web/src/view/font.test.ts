import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { measureLines, measureText, wrapText, type FontMetrics } from './font';
import { FIXED_FONT } from './test-font';

describe('measuring and wrapping', () => {
  test('a line is as wide as its glyphs advance', () => {
    expect(measureText(FIXED_FONT, '')).toBe(0);
    expect(measureText(FIXED_FONT, 'FRODO')).toBe(20);
    expect(measureLines(FIXED_FONT, ['ab', 'abcd'])).toBe(16);
  });

  test('a character outside the font takes the "not defined" glyph', () => {
    expect(measureText(FIXED_FONT, 'û')).toBe(4);
  });

  test('wraps at spaces and keeps the line breaks in the text', () => {
    expect(wrapText(FIXED_FONT, 'One two\nthree   four five', 40)).toEqual([
      'One two',
      'three four',
      'five'
    ]);
    expect(wrapText(FIXED_FONT, 'One\n\ntwo\n', 40)).toEqual([
      'One',
      '',
      'two'
    ]);
  });

  test('a word wider than the line gets a line of its own', () => {
    expect(wrapText(FIXED_FONT, 'a abcdefghijk b', 20)).toEqual([
      'a',
      'abcdefghijk',
      'b'
    ]);
  });
});

// The exported assets, which tests skip without (bun run export:web).
const lordPath = new URL(
  '../../public/assets/fonts/lord-10.json',
  import.meta.url
).pathname;
const textPath = new URL('../../public/assets/text.json', import.meta.url)
  .pathname;

// finding:data-formats-lord-font-metrics
describe.skipIf(!existsSync(lordPath) || !existsSync(textPath))(
  'lord/10',
  () => {
    // Read on first use: a skipped describe still runs its body.
    let loaded: FontMetrics | undefined;
    const lordFont = () =>
      (loaded ??= JSON.parse(readFileSync(lordPath, 'utf8')) as FontMetrics);

    test('measures with the original glyph advances', () => {
      expect(lordFont().height).toBe(10);
      // i advances 2, a 4, M 6 and a space 2.
      expect(measureText(lordFont(), 'i a M')).toBe(2 + 2 + 4 + 2 + 6);
    });

    // The Palantír's vision, BScene.res CSTR 37, in its 256-wide box 64
    // deep (finding:objects-use-message-boxes): its own four lines fit the
    // box's 236 pixels of text, so with the heading it is five lines.
    test('the Palantír vision fits its box', () => {
      const texts = JSON.parse(readFileSync(textPath, 'utf8')) as {
        resources: { id: number; source_file: string; text: string }[];
      };
      const vision = texts.resources.find(
        r => r.source_file === 'BScene.res' && r.id === 37
      )!.text;
      const lines = wrapText(lordFont(), vision.trim(), 256 - 20);
      expect(lines).toEqual(vision.trim().split('\n'));
      expect(lines).toHaveLength(4);
      expect(measureLines(lordFont(), lines)).toBeLessThanOrEqual(236);
      // The heading and the vision's lines, 10 apart from y 8.
      expect(8 + (1 + lines.length) * lordFont().height).toBeLessThanOrEqual(
        64
      );
    });
  }
);
