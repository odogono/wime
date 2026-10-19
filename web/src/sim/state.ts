import { INITIAL_CLOCK, tickClock, type Clock } from './clock';
import { createRng, type RngState } from './rng';
import {
  loadStartingState,
  type Place,
  type PlaceKind,
  type RosterEntry
} from './starting-state';

// All simulation state, kept serialisable at all times (ADR-0002):
// plain data only, so JSON round-trips it exactly. The roster, Places
// and Place kinds come from the starting state recovered by RE (#5,
// loaded by loadStartingState); Forces are derived from the roster's
// leader chains whenever they are needed (#9).
export interface SimState {
  clock: Clock;
  placeKinds: PlaceKind[];
  places: Place[];
  // The roster index of the Ring-bearer, or null before the starting
  // state is loaded (docs/spec/starting-state.md).
  ringBearer: number | null;
  rng: RngState;
  roster: RosterEntry[];
}

// Start a game. With no starting state the world is empty and only the
// clock runs, which is all the clock tests need; a real game passes
// the parsed starting-state.json, whose clock is the opening date and
// time (docs/spec/starting-state.md).
export const createSim = (seed: number, startingState?: unknown): SimState => {
  if (startingState === undefined) {
    return {
      clock: { ...INITIAL_CLOCK },
      placeKinds: [],
      places: [],
      ringBearer: null,
      rng: createRng(seed),
      roster: []
    };
  }
  const start = loadStartingState(startingState);
  return {
    clock: {
      day: start.clock.day,
      quarterHour: start.clock.quarterHour
    },
    placeKinds: start.placeKinds,
    places: start.places,
    ringBearer: start.ringBearer,
    rng: createRng(seed),
    roster: start.roster
  };
};

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
    typeof parsed.clock?.quarterHour !== 'number' ||
    !Array.isArray(parsed.roster) ||
    !Array.isArray(parsed.places) ||
    !Array.isArray(parsed.placeKinds)
  ) {
    throw new Error('Not a serialised SimState');
  }
  return parsed;
};
