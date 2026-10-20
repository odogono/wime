import { describe, expect, test } from 'bun:test';

import { MIRROR_HEADING } from '../sim/index';
import {
  ARCHIVE_HEADING,
  ARCHIVE_MESSAGES,
  archiveMenu
} from './archive-window';
import { measureLines, measureText } from './font';
import { layoutMirrorWindow } from './mirror-window';
import { TOPAZ_ALT_METRICS, topazAltRows } from './topaz-alt';

describe('topaz-alt', () => {
  test('draws printable ASCII and a "not defined" glyph, each 8 by 8', () => {
    const rows = topazAltRows();
    expect(rows.length).toBe(96);
    expect(TOPAZ_ALT_METRICS.glyphs.length).toBe(96);
    for (const glyph of rows) {
      expect(glyph.length).toBe(8);
      for (const row of glyph) {
        expect(row).toMatch(/^[#.]{7}\.$/);
      }
    }
  });

  test('advances 8 a glyph, as topaz/8 does', () => {
    expect(measureText(TOPAZ_ALT_METRICS, 'Galadriel')).toBe(72);
    expect(TOPAZ_ALT_METRICS.baseline).toBe(6);
    expect(TOPAZ_ALT_METRICS.height).toBe(8);
  });

  test("keeps the Mirror's heading inside its box", () => {
    const window = layoutMirrorWindow({ evil: [], good: [] });
    expect(20 + measureText(TOPAZ_ALT_METRICS, MIRROR_HEADING)).toBeLessThan(
      window.width
    );
  });

  test("keeps the Archive menu's lettering inside it", () => {
    const menu = archiveMenu();
    if (menu.kind !== 'menu') {
      throw new Error('expected a menu');
    }
    // The menu box is 224 wide with its text 20 in.
    expect(20 + measureText(TOPAZ_ALT_METRICS, ARCHIVE_HEADING)).toBeLessThan(
      224
    );
    for (const button of menu.buttons) {
      expect(3 + measureText(TOPAZ_ALT_METRICS, button.label)).toBeLessThan(
        button.width
      );
    }
    // A message window grows to its longest line, within the screen.
    for (const lines of Object.values(ARCHIVE_MESSAGES)) {
      expect(40 + measureLines(TOPAZ_ALT_METRICS, lines)).toBeLessThan(560);
    }
  });
});
