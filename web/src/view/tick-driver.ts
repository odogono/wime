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

// A quarter-hour waits 256 frames on Normal and 30 on Hasty at 50 Hz;
// Very Hasty has no wait, and the roster sweep takes 4 frames on average
// (finding:time-game-speed-clock-limits,
// finding:time-game-speed-rates-observed).
const MS_PER_TICK: Record<GameSpeed, number> = {
  hasty: 30 * FRAME_MS,
  normal: 256 * FRAME_MS,
  'very-hasty': 4 * FRAME_MS
};

export interface TickDriver {
  // Call once per rendered frame with elapsed real time.
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
