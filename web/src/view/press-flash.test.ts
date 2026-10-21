import { describe, expect, test } from 'bun:test';

import {
  GLASS_TOGGLES,
  PRESS_TOGGLES,
  flashOver,
  flashSwapped,
  swapColours
} from './press-flash';

// finding:ui-press-flash
describe('the press flash', () => {
  const flash = {
    area: { height: 8, width: 8, x: 0, y: 0 },
    start: 1000,
    toggles: PRESS_TOGGLES
  };

  test('shows swapped for the first, third and fifth 4 frames, and is over after 24', () => {
    const swapped = [0, 80, 160, 240, 320, 400].map(t =>
      flashSwapped(flash, 1000 + t + 1)
    );
    expect(swapped).toEqual([true, false, true, false, true, false]);
    expect(flashOver(flash, 1000 + 479)).toBe(false);
    expect(flashOver(flash, 1000 + 480)).toBe(true);
    expect(flashOver({ ...flash, toggles: GLASS_TOGGLES }, 1000 + 320)).toBe(
      true
    );
  });

  test('swaps colour c for c XOR 8, and leaves colours not in the palette', () => {
    const palette = Array.from(
      { length: 16 },
      (_, i) => `#${i.toString(16).padStart(2, '0')}0000`
    );
    const data = new Uint8ClampedArray([
      3, 0, 0, 255, 12, 0, 0, 255, 7, 7, 7, 255
    ]);
    swapColours(data, palette);
    expect([...data]).toEqual([11, 0, 0, 255, 4, 0, 0, 255, 7, 7, 7, 255]);
  });
});
