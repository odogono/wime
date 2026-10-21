import { describe, expect, test } from 'bun:test';

import {
  CLOCK_WAIT_MS,
  SWEEP_MS,
  advanceAnimationPace,
  animationPace
} from './animation-pace';

const run = (ms: number, travelling: boolean, held = false): number => {
  let pace = animationPace();
  let ticks = 0;
  for (let t = 0; t < ms; t += 20) {
    const step = advanceAnimationPace(pace, 20, travelling, held);
    pace = step.pace;
    ticks += step.ticks;
  }
  return ticks;
};

describe('the Animation Level pace', () => {
  test('a sweep every 151 frames while the watched Character travels', () => {
    expect(SWEEP_MS).toBe(3020);
    expect(run(SWEEP_MS * 3, true)).toBe(3);
  });

  test('a quarter-hour every 256 frames otherwise', () => {
    expect(CLOCK_WAIT_MS).toBe(5120);
    expect(run(CLOCK_WAIT_MS * 2, false)).toBe(2);
  });

  test('nothing ticks while the sweep is held', () => {
    expect(run(60_000, true, true)).toBe(0);
  });
});
