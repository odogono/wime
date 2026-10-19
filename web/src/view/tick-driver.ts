// The tick driver: maps real time to sim ticks according to the Game
// Speed. It lives in the view because the sim has no knowledge of Game
// Speed or pausing (ADR-0002, docs/spec/time.md).

export type GameSpeed = 'hasty' | 'normal' | 'very-hasty';

export const GAME_SPEEDS: { label: string; speed: GameSpeed }[] = [
  { label: 'Normal', speed: 'normal' },
  { label: 'Hasty', speed: 'hasty' },
  { label: 'Very Hasty', speed: 'very-hasty' }
];

// Provisional until the original's frame-counter limits are traced
// (docs/spec/time.md): one game day (96 ticks) in 96, 48 or 24 seconds.
export const TICKS_PER_SECOND: Record<GameSpeed, number> = {
  hasty: 2,
  normal: 1,
  'very-hasty': 4
};

export interface TickDriver {
  // Feed elapsed real time in; get back how many ticks are due.
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
      const msPerTick = 1000 / TICKS_PER_SECOND[driver.speed];
      const ticks = Math.floor(accumulatedMs / msPerTick);
      accumulatedMs -= ticks * msPerTick;
      return ticks;
    },
    paused: false,
    speed
  };
  return driver;
};
