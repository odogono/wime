import { INITIAL_CLOCK, tickClock, type Clock } from './clock';
import { tickMovement, type Tilemap } from './movement';
import { createRng, type RngState } from './rng';
import {
  DEFAULT_SPEEDS,
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
  // Default Orders queues, popped on arrival
  // (finding:movement-arrival-pops-next-route-stop).
  routes: number[][];
  speeds: { diagonal: number[]; straight: number[] };
  terrainByTile: number[];
  // The Campaign Level tile grid movement steers over, or null for a
  // clock-only game with no map loaded.
  tilemap: Tilemap | null;
}

// Start a game. With no starting state the world is empty and only the
// clock runs, which is all the clock tests need; a real game passes
// the parsed starting-state.json, whose clock is the opening date and
// time (docs/spec/starting-state.md).
export const createSim = (
  seed: number,
  startingState?: unknown,
  tilemap?: Tilemap | null
): SimState => {
  if (startingState === undefined) {
    return {
      clock: { ...INITIAL_CLOCK },
      placeKinds: [],
      places: [],
      ringBearer: null,
      rng: createRng(seed),
      roster: [],
      routes: [],
      speeds: {
        diagonal: [...DEFAULT_SPEEDS.diagonal],
        straight: [...DEFAULT_SPEEDS.straight]
      },
      terrainByTile: [],
      tilemap: tilemap ?? null
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
    roster: start.roster,
    routes: start.routes,
    speeds: start.speeds,
    terrainByTile: start.terrainByTile,
    tilemap: tilemap ?? null
  };
};

// One tick: every Leader takes its movement step in roster order,
// then the clock steps one quarter-hour, as the original advanced
// it after the sweep reached entry 151
// (finding:time-clock-advances-after-each-roster-sweep).
export const tickSim = (state: SimState): SimState => {
  const moved = tickMovement(state);
  return { ...moved, clock: tickClock(moved.clock) };
};

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
  // States serialised before movement landed have no route, speed,
  // terrain or tilemap fields; fill them with the empty defaults.
  const legacy = parsed as Partial<SimState>;
  return {
    ...parsed,
    roster: parsed.roster.map(entry => ({
      ...entry,
      fraction: entry.fraction ?? 0
    })),
    routes: legacy.routes ?? [],
    speeds: legacy.speeds ?? {
      diagonal: [...DEFAULT_SPEEDS.diagonal],
      straight: [...DEFAULT_SPEEDS.straight]
    },
    terrainByTile: legacy.terrainByTile ?? [],
    tilemap: legacy.tilemap ?? null
  };
};
