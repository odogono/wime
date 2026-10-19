import { INITIAL_CLOCK, tickClock, type Clock } from './clock';
import { createRng, type RngState } from './rng';

// All simulation state, kept serialisable at all times (ADR-0002):
// plain data only, so JSON round-trips it exactly. Forces and Places
// join this shape when the starting state lands (#9).
export interface SimState {
  clock: Clock;
  rng: RngState;
}

export const createSim = (seed: number): SimState => ({
  clock: { ...INITIAL_CLOCK },
  rng: createRng(seed)
});

// One tick: the clock steps one quarter-hour. Movement and everything
// else that happens per tick joins here as the slices land.
export const tickSim = (state: SimState): SimState => ({
  ...state,
  clock: tickClock(state.clock)
});

export const serializeSim = (state: SimState): string => JSON.stringify(state);

export const deserializeSim = (text: string): SimState => {
  const parsed = JSON.parse(text) as SimState;
  if (
    typeof parsed.rng !== 'number' ||
    typeof parsed.clock?.day !== 'number' ||
    typeof parsed.clock?.quarterHour !== 'number'
  ) {
    throw new Error('Not a serialised SimState');
  }
  return parsed;
};
