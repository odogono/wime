import {
  INITIAL_CLOCK,
  QUARTER_HOURS_PER_HOUR,
  tickClock,
  type Clock
} from './clock';
import { findMatch, startFight, type Fight } from './combat';
import { councilDue, holdCouncil, type CouncilMessage } from './council';
import type { Passing } from './encounters';
import type { Ending } from './endings';
import { startMeeting, type Meeting } from './meetings';
import { sweepMovement, type Tilemap } from './movement';
import { ringAtBaradDur, ringAtMountDoom } from './ring';
import { createRng, type RngState } from './rng';
import {
  DEFAULT_SPEEDS,
  emptyObjectPlacements,
  loadStartingState,
  type ObjectPlacement,
  type Place,
  type PlaceKind,
  type RosterEntry
} from './starting-state';
import { wakeEntry } from './wake';
import {
  INITIAL_WAR_EVENTS,
  dailyWarEvents,
  isDailyCheck,
  tripwires,
  type WarEventAnnouncement,
  type WarEvents
} from './war-events';

// All simulation state, kept serialisable at all times (ADR-0002):
// plain data only, so JSON round-trips it exactly. The roster, Places
// and Place kinds come from the starting state recovered by RE (#5,
// loaded by loadStartingState); Forces are derived from the roster's
// leader chains whenever they are needed (#9).
export interface SimState {
  // War Events to tell the player of, oldest first, until the view
  // takes them (takeAnnouncement).
  announcements: WarEventAnnouncement[];
  clock: Clock;
  // The Council of Elrond's message, waiting for the view to close it,
  // or null. Game time stands still while one is
  // (docs/spec/council-of-elrond.md).
  council: CouncilMessage | null;
  // Whether the Council of Elrond is still to come
  // (finding:ai-council-of-elrond-trigger).
  councilPending: boolean;
  // How the game ended, or null while it goes on. Nothing moves once
  // it has ended (docs/spec/combat.md, "Endings").
  ending: Ending | null;
  // The fight under way, or null. Game time stands still while one is
  // (finding:time-stops-during-a-fight).
  fight: Fight | null;
  // The meeting waiting for the player's answer, or null. Game time
  // stands still while one is (finding:ui-meeting-window).
  meeting: Meeting | null;
  // The 30 slots of objects lying on the map, null where free
  // (docs/spec/objects.md).
  objectPlacements: (ObjectPlacement | null)[];
  // Encounters passed by, oldest first, until the view takes them
  // (takePassing) (finding:forces-anonymous-encounters-pass-by).
  passings: Passing[];
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
  // The roster entry the next tick's sweep starts from: 0, or the
  // entry after the one whose step started a fight.
  sweepFrom: number;
  terrainByTile: number[];
  // The Campaign Level tile grid movement steers over, or null for a
  // clock-only game with no map loaded.
  tilemap: Tilemap | null;
  warEvents: WarEvents;
  // The roster entry the Animation Level watches, or null while the
  // Campaign Level is on show. The Encounter search depends on it
  // (docs/spec/encounters.md); the view sets it (watchEntry).
  watching: number | null;
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
      announcements: [],
      clock: { ...INITIAL_CLOCK },
      council: null,
      councilPending: true,
      ending: null,
      fight: null,
      meeting: null,
      objectPlacements: emptyObjectPlacements(),
      passings: [],
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
      sweepFrom: 0,
      terrainByTile: [],
      tilemap: tilemap ?? null,
      warEvents: { ...INITIAL_WAR_EVENTS, days: [...INITIAL_WAR_EVENTS.days] },
      watching: null
    };
  }
  const start = loadStartingState(startingState);
  return {
    announcements: [],
    clock: {
      day: start.clock.day,
      quarterHour: start.clock.quarterHour
    },
    council: null,
    councilPending: true,
    ending: null,
    fight: null,
    meeting: null,
    objectPlacements: start.objectPlacements,
    passings: [],
    placeKinds: start.placeKinds,
    places: start.places,
    ringBearer: start.ringBearer,
    rng: createRng(seed),
    roster: start.roster,
    routes: start.routes,
    speeds: start.speeds,
    sweepFrom: 0,
    terrainByTile: start.terrainByTile,
    tilemap: tilemap ?? null,
    warEvents: start.warEvents,
    watching: null
  };
};

// One tick: every Leader takes its movement step in roster order,
// then the clock steps one quarter-hour, as the original advanced
// it after the sweep reached entry 151
// (finding:time-clock-advances-after-each-roster-sweep). A step that
// starts a fight or a meeting stops the sweep and the clock until the
// fight is over or the meeting answered; the next tick carries on from
// the following entry (docs/spec/combat.md, docs/spec/forces.md). An
// Encounter passed by is queued for the view and the sweep goes on. On
// each hour the Council of Elrond may be held, and when the clock
// reaches 8 a.m. the daily War Event check then runs before the next
// sweep, unless the Animation Level is showing
// (docs/spec/council-of-elrond.md,
// finding:time-daily-check-opens-the-8am-sweep).
export const tickSim = (state: SimState): SimState =>
  sweep(state, state.watching);

// The Animation Level's sweep waits at the watched Character, the one
// it stopped before, until its figures walk off (releaseWatched).
// Watching the empty entry 0, nobody, time stands still
// (finding:time-animation-level-holds-the-sweep-at-the-watched-character).
export const isHeld = (state: SimState): boolean =>
  state.watching !== null &&
  (state.watching === NOBODY || state.sweepFrom === state.watching);

// The watched Character's figures have walked off: one tick moves it
// the held pixel and the sweep runs on
// (finding:movement-watched-character-advances-as-its-figures-walk-off).
export const releaseWatched = (state: SimState): SimState =>
  state.watching === null || state.watching === NOBODY
    ? state
    : sweep(state, null);

const NOBODY = 0;

const sweep = (state: SimState, holdAt: number | null): SimState => {
  if (state.fight || state.meeting || state.council || state.ending) {
    return state;
  }
  if (holdAt !== null && isHeld(state)) {
    return state;
  }
  const { heldAt, stoppedAt, world } = sweepMovement(
    state,
    state.sweepFrom,
    (moved, index) => {
      moved.warEvents = tripwires(
        moved.warEvents,
        moved.roster[index]!,
        moved.clock.day
      );
      const lost = ringAtBaradDur(moved.roster[index]!);
      if (lost) {
        return { ...moved, ending: lost };
      }
      const match = findMatch(moved, index);
      if (!match) {
        return null;
      }
      if ('passing' in match) {
        moved.passings = [...moved.passings, match.passing];
        return null;
      }
      return 'fight' in match
        ? startFight(moved, match.fight)
        : startMeeting(moved, match.meeting);
    },
    wakeEntry,
    holdAt
  );
  if (heldAt !== undefined) {
    return { ...world, sweepFrom: heldAt };
  }
  if (stoppedAt !== null) {
    return { ...world, sweepFrom: stoppedAt + 1 };
  }
  const stepped = { ...world, clock: tickClock(world.clock), sweepFrom: 0 };
  const council = councilDue(stepped) ? holdCouncil(stepped) : stepped;
  const won = onTheHour(council)
    ? ringAtMountDoom(council.roster, council.ringBearer)
    : null;
  return won ? { ...council, ending: won } : dailyChecks(council);
};

// The hourly tests on the Campaign Level, after the Council's
// (finding:objects-ring-at-mount-doom-checked-hourly).
const onTheHour = (state: SimState): boolean =>
  state.watching === null &&
  state.clock.quarterHour % QUARTER_HOURS_PER_HOUR === 0;

// The daily War Event check, run only on the Campaign Level: an 8 a.m.
// that passes on the Animation Level loses that day's check
// (finding:ai-war-events-checked-only-on-campaign-level).
const dailyChecks = (state: SimState): SimState => {
  if (state.watching !== null || !isDailyCheck(state.clock)) {
    return state;
  }
  const { announcements, events } = dailyWarEvents(
    state.warEvents,
    state.roster,
    state.clock.day
  );
  return {
    ...state,
    announcements: [...state.announcements, ...announcements],
    warEvents: events
  };
};

// Hand the oldest waiting announcement to the view as it is about to be
// shown, so each is shown once and the rest survive a save.
export const takeAnnouncement = (
  state: SimState
): { announcement: WarEventAnnouncement | null; state: SimState } => {
  const [announcement, ...rest] = state.announcements;
  return announcement
    ? { announcement, state: { ...state, announcements: rest } }
    : { announcement: null, state };
};

// Hand the oldest Encounter passed by to the view, as takeAnnouncement
// does.
export const takePassing = (
  state: SimState
): { passing: Passing | null; state: SimState } => {
  const [passing, ...rest] = state.passings;
  return passing
    ? { passing, state: { ...state, passings: rest } }
    : { passing: null, state };
};

// Watch a roster entry on the Animation Level, or null on going up to
// the Campaign Level.
export const watchEntry = (
  state: SimState,
  index: number | null
): SimState => ({ ...state, watching: index });

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
    announcements: legacy.announcements ?? [],
    council: legacy.council ?? null,
    councilPending: legacy.councilPending ?? true,
    ending: legacy.ending ?? null,
    fight: legacy.fight ?? null,
    meeting: legacy.meeting ?? null,
    objectPlacements: legacy.objectPlacements ?? emptyObjectPlacements(),
    passings: legacy.passings ?? [],
    roster: parsed.roster.map(entry => ({
      ...entry,
      fraction: entry.fraction ?? 0
    })),
    routes: legacy.routes ?? [],
    speeds: legacy.speeds ?? {
      diagonal: [...DEFAULT_SPEEDS.diagonal],
      straight: [...DEFAULT_SPEEDS.straight]
    },
    sweepFrom: legacy.sweepFrom ?? 0,
    terrainByTile: legacy.terrainByTile ?? [],
    tilemap: legacy.tilemap ?? null,
    warEvents: legacy.warEvents ?? {
      ...INITIAL_WAR_EVENTS,
      days: [...INITIAL_WAR_EVENTS.days]
    },
    watching: legacy.watching ?? null
  };
};
