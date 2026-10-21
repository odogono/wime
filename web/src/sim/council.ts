// The Council of Elrond (docs/spec/council-of-elrond.md): held once,
// on the hour on the Campaign Level, when the Ring-bearer's Force
// reaches Rivendell with Gandalf there. It forms the Fellowship under
// Gandalf, moves the calendar on and leaves a message for the view.

import { QUARTER_HOURS_PER_HOUR } from './clock';
import { openBilbo } from './encounters';
import { topLeader, type Point, type RosterEntry } from './starting-state';
import type { SimState } from './state';

export const RIVENDELL: Point = { x: 1216, y: 384 };
// Gandalf waits at (1216, 380) until he wakes and steps onto Rivendell
// (finding:ai-council-of-elrond-trigger).
const GANDALF_WAITING_Y = 380;

const GANDALF = 1;
const FRODO = 7;
const ELROND = 3;
const GLORFINDEL = 4;
const GIMLI = 12;
// Aragorn to Pippin, taken from the last down
// (finding:forces-council-forms-the-fellowship-under-gandalf).
const FIRST_COMPANION = 5;
const LAST_COMPANION = 10;
const FIRST_NAZGUL = 79;
const LAST_NAZGUL = 87;
// Entries put at their destinations
// (finding:movement-council-puts-forces-at-their-destinations).
const LAST_MOVED = 150;

// The message naming the Ring-bearer, waiting for the view
// (finding:ui-council-of-elrond-message).
export interface CouncilMessage {
  ringBearer: number;
}

const isAt = (position: Point | null, x: number, y: number): boolean =>
  position !== null && position.x === x && position.y === y;

const atRivendell = (roster: RosterEntry[], entry: RosterEntry): boolean =>
  isAt(topLeader(roster, entry).position, RIVENDELL.x, RIVENDELL.y);

// Whether the Council is held at this clock step
// (finding:ai-council-of-elrond-trigger).
export const councilDue = (state: SimState): boolean => {
  if (
    !state.councilPending ||
    state.watching !== null ||
    state.ringBearer === null ||
    state.clock.quarterHour % QUARTER_HOURS_PER_HOUR !== 0
  ) {
    return false;
  }
  const bearer = state.roster[state.ringBearer];
  const gandalf = state.roster[GANDALF];
  return (
    bearer !== undefined &&
    gandalf !== undefined &&
    atRivendell(state.roster, bearer) &&
    (isAt(gandalf.position, RIVENDELL.x, RIVENDELL.y) ||
      isAt(gandalf.position, RIVENDELL.x, GANDALF_WAITING_Y))
  );
};

// The calendar jump (finding:time-council-moves-the-calendar-on).
export const dayAfterCouncil = (day: number): number => {
  if (day < 32) {
    return day + 60;
  }
  return day > 82 ? day + 10 : 92;
};

// Hold the Council: every change, in the original's order
// (docs/spec/council-of-elrond.md, "What it does").
export const holdCouncil = (state: SimState): SimState => {
  const roster = [...state.roster];
  const set = (index: number, change: Partial<RosterEntry>): void => {
    const entry = roster[index];
    if (entry) {
      roster[index] = { ...entry, ...change };
    }
  };
  const gandalfAlive = (roster[GANDALF]?.strength ?? 0) !== 0;
  for (let index = LAST_COMPANION; index >= FIRST_COMPANION; index--) {
    const entry = roster[index];
    if (!entry || !atRivendell(roster, entry)) {
      continue;
    }
    set(index, { health: entry.maxHealth });
    if (entry.leader !== FRODO && gandalfAlive) {
      set(index, { leader: GANDALF });
    }
  }
  let ringBearer = state.ringBearer!;
  if (ringBearer === ELROND || ringBearer === GLORFINDEL) {
    ringBearer = GIMLI;
  }
  if (gandalfAlive) {
    set(GANDALF, { state: 1, trigger: { kind: 'none' }, triggerByte: 0 });
    if (ringBearer !== GANDALF) {
      set(ringBearer, { leader: GANDALF });
    }
  }
  set(ELROND, { state: 0 });
  set(GLORFINDEL, { state: 0 });
  for (let index = FIRST_NAZGUL; index <= LAST_NAZGUL; index++) {
    set(index, { state: 0, trigger: { kind: 'none' }, triggerByte: 0 });
  }
  const opened = openBilbo(roster);
  for (let index = 1; index <= LAST_MOVED; index++) {
    const entry = opened[index];
    // Followers too: the test looks only at the destination.
    if (entry?.destination && entry.destination.x) {
      opened[index] = { ...entry, position: { ...entry.destination } };
    }
  }
  return {
    ...state,
    clock: { ...state.clock, day: dayAfterCouncil(state.clock.day) },
    council: { ringBearer },
    councilPending: false,
    ringBearer,
    roster: opened
  };
};

// The view closes the message once its 1200 frames are up, and game
// time runs again.
export const closeCouncil = (state: SimState): SimState =>
  state.council ? { ...state, council: null } : state;
