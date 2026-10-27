import { describe, expect, test } from 'bun:test';

import {
  FLASH_STEP_MS,
  GLASS_TOGGLES,
  createPresses,
  swapColours,
  type FlashShows
} from './press-flash';

const area = { height: 8, width: 8, x: 0, y: 0 };

const setUp = () => {
  let now = 1000;
  const log: string[] = [];
  const presses = createPresses({
    now: () => now,
    ring: () => log.push('ring'),
    show: (_, shows: FlashShows) => log.push(shows)
  });
  // Run frames until the flash lets the game go on.
  const runFrames = (): number => {
    let frames = 0;
    while (presses.frame(now)) {
      frames += 1;
      now += FLASH_STEP_MS;
    }
    return frames;
  };
  return {
    log,
    presses,
    runFrames,
    tick: (ms: number) => {
      now += ms;
    }
  };
};

// finding:ui-press-flash
describe('the press flash', () => {
  test('rings once, shows swapped and plain three times, then acts once', () => {
    const { log, presses, runFrames } = setUp();
    presses.press(area, () => log.push('act'));
    expect(presses.holding).toBe(true);
    expect(runFrames()).toBe(6);
    expect(log).toEqual([
      'ring',
      'swapped',
      'plain',
      'swapped',
      'plain',
      'swapped',
      'plain',
      'over',
      'act'
    ]);
    expect(presses.holding).toBe(false);
    expect(presses.frame(5000)).toBe(false);
    expect(log.filter(l => l === 'act')).toHaveLength(1);
  });

  test('is not over until 24 frames have passed', () => {
    const { log, presses, tick } = setUp();
    presses.press(area, () => log.push('act'));
    tick(6 * FLASH_STEP_MS - 1);
    expect(presses.frame(1000 + 6 * FLASH_STEP_MS - 1)).toBe(true);
    expect(log).not.toContain('act');
    expect(presses.frame(1000 + 6 * FLASH_STEP_MS)).toBe(false);
    expect(log).toContain('act');
  });

  test('ignores another press while it holds the game', () => {
    const { log, presses, runFrames } = setUp();
    presses.press(area, () => log.push('first'));
    presses.frame(1000);
    presses.press(area, () => log.push('second'));
    runFrames();
    expect(log.filter(l => l === 'ring')).toHaveLength(1);
    expect(log).toContain('first');
    expect(log).not.toContain('second');
  });

  test('flashes the magnifying glass for 4 toggles', () => {
    const { log, presses, runFrames } = setUp();
    presses.press(area, () => log.push('act'), GLASS_TOGGLES);
    expect(runFrames()).toBe(4);
    expect(log.at(-1)).toBe('act');
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
