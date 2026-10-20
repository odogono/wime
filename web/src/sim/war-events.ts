import { QUARTER_HOURS_PER_HOUR, type Clock } from './clock';
import type { RosterEntry } from './starting-state';

// The War Events (docs/spec/war-events.md): a mask of event bits, each
// set once, with the day it was set. The daily check runs as the clock
// reaches 8 a.m. (finding:time-daily-check-opens-the-8am-sweep).

export interface WarEvents {
  // Event day by bit, 0 to 7, as the low byte of the day count. Slot 0
  // is unused: the original keeps the Ring-bearer there.
  days: number[];
  mask: number;
}

// A War Event the player is told of, waiting for the view to show it
// (finding:ui-war-event-messages).
export interface WarEventAnnouncement {
  day: number;
  event: 4 | 7;
}

// Only bits 0 and 2 are set at the start, so only the Ring-bearer and
// Gandalf proximity triggers are live (finding:ai-war-events-set-once).
export const INITIAL_WAR_EVENTS: WarEvents = {
  days: [0, 0, 0, 0, 0, 0, 0, 0],
  mask: 0x05
};

export const DAILY_CHECK_HOUR = 8;
export const SARUMAN_MARCHES_DAY = 149;
export const DARK_LORD_MARCHES_DAY = 169;

// Roster entries the daily check reads
// (finding:ai-second-gandalf-wakes-when-the-first-sleeps,
// finding:ai-war-events-set-once).
export const GANDALF = 1;
export const THEODEN = 26;
export const DENETHOR = 32;

export const WAR_EVENT_MESSAGES: Record<WarEventAnnouncement['event'], string> =
  {
    4: "Saruman's army is on the march!",
    7: "The Dark Lord's armies march forth!"
  };

export const hasWarEvent = (events: WarEvents, bit: number): boolean =>
  (events.mask & (1 << bit)) !== 0;

// Set an event if it is clear, recording the day; a set event keeps its
// first day. Used by the daily check and by the movement tripwires
// (finding:mobilisation-tripwires-follow-arrival).
export const setWarEvent = (
  events: WarEvents,
  bit: number,
  day: number
): WarEvents => {
  if (hasWarEvent(events, bit)) {
    return events;
  }
  const days = [...events.days];
  days[bit] = day & 0xff;
  return { days, mask: events.mask | (1 << bit) };
};

export const isDailyCheck = (clock: Clock): boolean =>
  clock.quarterHour === DAILY_CHECK_HOUR * QUARTER_HOURS_PER_HOUR;

const mobilised = (entry: RosterEntry | undefined): boolean =>
  entry !== undefined && entry.allegiance > 1;

// The daily check, in the original's order (finding:ai-war-events-set-once).
// Event 7 comes last, so the events it brings follow at the next check.
export const dailyWarEvents = (
  events: WarEvents,
  roster: RosterEntry[],
  day: number
): { announcements: WarEventAnnouncement[]; events: WarEvents } => {
  const announcements: WarEventAnnouncement[] = [];
  let next = events;
  const gandalf = roster[GANDALF];
  if (
    gandalf !== undefined &&
    gandalf.state === 0 &&
    gandalf.triggerByte === 0 &&
    !hasWarEvent(next, 1)
  ) {
    // Bits 1 and 2, with no day recorded.
    next = { ...next, mask: next.mask | 0x06 };
  }
  const darkLord = hasWarEvent(next, 7);
  if ((day === SARUMAN_MARCHES_DAY || darkLord) && !hasWarEvent(next, 4)) {
    next = setWarEvent(next, 4, day);
    announcements.push({ day, event: 4 });
  }
  if (mobilised(roster[THEODEN])) {
    next = setWarEvent(next, 5, day);
  }
  if (mobilised(roster[DENETHOR]) || darkLord) {
    next = setWarEvent(next, 3, day);
  }
  if (darkLord) {
    next = setWarEvent(next, 6, day);
  }
  if (day === DARK_LORD_MARCHES_DAY && !hasWarEvent(next, 7)) {
    next = setWarEvent(next, 7, day);
    announcements.push({ day, event: 7 });
  }
  return { announcements, events: next };
};

// The movement tripwires (finding:mobilisation-tripwires-follow-arrival):
// a Leader landing on a tile origin sets events silently, only once.
// An Evil Leader on the Isen Ford sets events 3 and 5
// (finding:mobilisation-evil-at-the-fords-of-isen); a non-Evil Leader at
// or beyond (1664, 1008) sets event 7
// (finding:ai-good-force-near-mordor-starts-the-war).
export const ISEN_FORD = { x: 1104, y: 928 };
export const MORDOR_APPROACHES = { x: 1664, y: 1008 };

export const tripwires = (
  events: WarEvents,
  leader: RosterEntry,
  day: number
): WarEvents => {
  const at = leader.position;
  if (at === null || at.x % 16 !== 0 || at.y % 16 !== 0) {
    return events;
  }
  if (leader.allegiance === 0) {
    return at.x === ISEN_FORD.x && at.y === ISEN_FORD.y
      ? setWarEvent(setWarEvent(events, 3, day), 5, day)
      : events;
  }
  return at.x >= MORDOR_APPROACHES.x && at.y >= MORDOR_APPROACHES.y
    ? setWarEvent(events, 7, day)
    : events;
};
