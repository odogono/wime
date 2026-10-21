import { FRAME_MS } from './tick-driver';

// How fast game time runs on the Animation Level
// (finding:time-animation-level-holds-the-sweep-at-the-watched-character),
// whatever the Game Speed. The original's sweep moves one roster entry
// a frame, so a sweep of 151 entries takes 151 frames; the clock then
// steps at once while the watched Character travels, and otherwise
// waits until the frame counter reaches 256. While the watched
// Character's figures walk the sweep is held (isHeld) and nothing
// ticks. A whole sweep at a time is the port's simplification.

export const SWEEP_MS = 151 * FRAME_MS;
export const CLOCK_WAIT_MS = 256 * FRAME_MS;

export interface AnimationPace {
  // Time towards the next tick, in ms.
  due: number;
}

export const animationPace = (): AnimationPace => ({ due: 0 });

// How many ticks are due after `elapsedMs`. Held time does not count
// towards the next tick.
export const advanceAnimationPace = (
  pace: AnimationPace,
  elapsedMs: number,
  travelling: boolean,
  held: boolean
): { pace: AnimationPace; ticks: number } => {
  if (held) {
    return { pace: { due: 0 }, ticks: 0 };
  }
  const interval = travelling ? SWEEP_MS : CLOCK_WAIT_MS;
  const due = pace.due + elapsedMs;
  const ticks = Math.floor(due / interval);
  return { pace: { due: due - ticks * interval }, ticks };
};
