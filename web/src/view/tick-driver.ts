// The tick driver: maps real time to sim ticks according to the Game
// Speed. It lives in the view because the sim has no knowledge of Game
// Speed or pausing (ADR-0002, docs/spec/time.md).

// One frame of the original's 50 Hz display.
export const FRAME_MS = 20;

export type GameSpeed = 'hasty' | 'normal' | 'very-hasty';

export const GAME_SPEEDS: { label: string; speed: GameSpeed }[] = [
  { label: 'Normal', speed: 'normal' },
  { label: 'Hasty', speed: 'hasty' },
  { label: 'Very Hasty', speed: 'very-hasty' }
];

// docs/spec/time.md: 256 or 30 frames at 50 Hz; Very Hasty has no
// clock wait and advances once per rendered frame instead.
const MS_PER_TICK: Record<GameSpeed, number> = {
  hasty: 30 * FRAME_MS,
  normal: 256 * FRAME_MS,
  'very-hasty': 0 // unused: Very Hasty ticks per frame
};

export interface TickDriver {
  // Call once per rendered frame with elapsed real time. Very Hasty
  // returns one tick per call so the view always gets to draw.
  advance(elapsedMs: number): number;
  paused: boolean;
  speed: GameSpeed;
}

export const createTickDriver = (speed: GameSpeed = 'normal'): TickDriver => {
  let accumulatedMs = 0;
  const driver: TickDriver = {
    advance: (elapsedMs: number): number => {
      if (driver.paused) {
        return 0;
      }
      if (driver.speed === 'very-hasty') {
        accumulatedMs = 0;
        return 1;
      }
      accumulatedMs += elapsedMs;
      const msPerTick = MS_PER_TICK[driver.speed];
      const ticks = Math.floor(accumulatedMs / msPerTick);
      accumulatedMs -= ticks * msPerTick;
      return ticks;
    },
    paused: false,
    speed
  };
  return driver;
};
