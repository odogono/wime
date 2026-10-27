import { describe, expect, test } from 'bun:test';

import { openSpeedWindow, speedAt } from './speed-window';
import { FIXED_FONT } from './test-font';

describe('the Game Speed window', () => {
  test("is the original's box, a column of buttons of the first one's width", () => {
    const window = openSpeedWindow(FIXED_FONT, 0, 'campaign');
    expect(window.box).toEqual({ height: 68, width: 90, x: 184, y: 5 });
    expect(window.heading).toBe('Rate of Time Passage');
    // "Very Hasty" is 10 glyphs of 4 pixels, and an area is 4 wider.
    expect(
      window.buttons.map(b => [b.label, b.speed, b.x, b.y, b.width])
    ).toEqual([
      ['Very Hasty', 'very-hasty', 210, 26, 44],
      ['Hasty', 'hasty', 210, 41, 44],
      ['Normal', 'normal', 210, 56, 44]
    ]);
  });

  test('a press sets the speed under it, and a press off the buttons nothing', () => {
    const window = openSpeedWindow(FIXED_FONT, 0, 'campaign');
    expect(speedAt(window, 211, 42)).toBe('hasty');
    expect(speedAt(window, 253, 56)).toBe('normal');
    expect(speedAt(window, 200, 42)).toBeUndefined();
    expect(speedAt(window, 211, 36)).toBeUndefined();
  });

  test('presses its default after 720 frames, 1,020 on the Animation Level, and never on the Full Map Level', () => {
    expect(openSpeedWindow(FIXED_FONT, 1000, 'campaign').until).toBe(
      1000 + 720 * 20
    );
    expect(openSpeedWindow(FIXED_FONT, 1000, 'animation').until).toBe(
      1000 + 1020 * 20
    );
    expect(openSpeedWindow(FIXED_FONT, 1000, 'full-map').until).toBeNull();
  });
});
