import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import type { Fight } from './combat';
import { restoreSave, serialiseSave } from './save';
import { createSim, takeAnnouncements, tickSim, type SimState } from './state';
import {
  DENETHOR,
  GANDALF,
  INITIAL_WAR_EVENTS,
  THEODEN,
  setWarEvent
} from './war-events';

// The War Events on a synthetic roster (docs/spec/war-events.md). Every
// entry sleeps with no strength, so nothing moves; the scenarios are
// those of docs/re/war-events-reference.md.

const entry = (index: number, over: Record<string, unknown> = {}) => ({
  allegiance: 1,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 1,
  figure: 0,
  health: 1,
  icon: 0,
  index,
  is_unit: false,
  leader: null,
  max_health: 1,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 2,
  stamina: 40,
  starting_strength: 1,
  state: 0,
  strength: 0,
  ticked: index > 0,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

// Gandalf starts asleep waiting for event 6, as in the Reference Build.
const world = (
  day: number,
  quarterHour: number,
  overrides: Record<number, Record<string, unknown>> = {}
): SimState =>
  createSim(1, {
    clock: { day, quarter_hour: quarterHour },
    events: { ring_bearer: 7 },
    place_kinds: [],
    places: [
      {
        announces_attacks: false,
        grid_byte: 0,
        grid_reference: null,
        index: 1,
        name: 'NOWHERE',
        position: { x: 0, y: 0 },
        tile: { x: 0, y: 0 },
        tile_kind: null
      }
    ],
    roster: Array.from({ length: 152 }, (_, index) =>
      entry(index, {
        ...(index === GANDALF ? { trigger_byte: 0x40 } : {}),
        ...overrides[index]
      })
    )
  });

const ticks = (state: SimState, n: number): SimState => {
  let next = state;
  for (let i = 0; i < n; i++) {
    next = tickSim(next);
  }
  return next;
};

// The event days of bits 1 to 7, as the reference scenarios list them.
const days = (state: SimState): number[] => state.warEvents.days.slice(1);

describe('war events', () => {
  test('start with mask 0x05 and every event day 0', () => {
    const sim = world(0, 64);
    expect(sim.warEvents).toEqual(INITIAL_WAR_EVENTS);
    expect(sim.announcements).toEqual([]);
    expect(createSim(1).warEvents).toEqual(INITIAL_WAR_EVENTS);
  });

  const startingStatePath = new URL(
    '../../public/assets/starting-state.json',
    import.meta.url
  );
  test.skipIf(!existsSync(startingStatePath))(
    'the exported starting state carries the recovered event state',
    () => {
      const sim = createSim(
        1,
        JSON.parse(readFileSync(startingStatePath, 'utf8'))
      );
      expect(sim.warEvents).toEqual(INITIAL_WAR_EVENTS);
    }
  );

  test('the check runs once a day, as quarter-hour 31 becomes 32', () => {
    // Day 149 at 7:30: nothing until the step to 8 a.m.
    let sim = tickSim(world(149, 30));
    expect(sim.warEvents.mask).toBe(0x05);
    sim = tickSim(sim);
    expect(sim.clock).toEqual({ day: 149, quarterHour: 32 });
    expect(sim.warEvents.mask).toBe(0x15);
    expect(days(sim)).toEqual([0, 0, 0, 149, 0, 0, 0]);
    expect(sim.announcements).toEqual([{ day: 149, event: 4 }]);
    // 8:15 to the next 8 a.m.: no second check, no second announcement.
    sim = ticks(sim, 96);
    expect(sim.clock).toEqual({ day: 150, quarterHour: 32 });
    expect(days(sim)).toEqual([0, 0, 0, 149, 0, 0, 0]);
    expect(sim.announcements).toEqual([{ day: 149, event: 4 }]);
  });

  test('day 148 sets nothing; a starting game at 8 a.m. does not check', () => {
    const sim = ticks(world(148, 31), 96);
    expect(sim.warEvents).toEqual(INITIAL_WAR_EVENTS);
    expect(sim.announcements).toEqual([]);
    // Only the step onto quarter-hour 32 runs the check.
    expect(tickSim(world(149, 32)).warEvents.mask).toBe(0x05);
  });

  test('day 169 sets event 7; events 3, 4 and 6 follow at the next check', () => {
    let sim = world(169, 31);
    sim = { ...sim, warEvents: setWarEvent(sim.warEvents, 4, 149) };
    sim = tickSim(sim);
    expect(sim.warEvents.mask).toBe(0x95);
    expect(days(sim)).toEqual([0, 0, 0, 149, 0, 0, 169]);
    expect(sim.announcements).toEqual([{ day: 169, event: 7 }]);
    sim = ticks(sim, 96);
    expect(sim.warEvents.mask).toBe(0xdd);
    // Event 4 keeps day 149, and Saruman is not announced again.
    expect(days(sim)).toEqual([0, 0, 170, 149, 0, 170, 169]);
    expect(sim.announcements).toEqual([{ day: 169, event: 7 }]);
  });

  test('a day-169 check that missed day 149 announces Saruman the next day', () => {
    const sim = ticks(world(169, 31), 1 + 96);
    expect(sim.warEvents.mask).toBe(0xdd);
    expect(days(sim)).toEqual([0, 0, 170, 170, 0, 170, 169]);
    expect(sim.announcements).toEqual([
      { day: 169, event: 7 },
      { day: 170, event: 4 }
    ]);
  });

  test('an early event 7 brings 3, 4 and 6 at the next check and silences day 169', () => {
    // Set at noon on day 100, as a tripwire would.
    let sim = world(100, 48);
    sim = { ...sim, warEvents: setWarEvent(sim.warEvents, 7, 100) };
    sim = ticks(sim, 96 - 48 + 31);
    expect(sim.warEvents.mask).toBe(0x85);
    sim = tickSim(sim);
    expect(sim.clock).toEqual({ day: 101, quarterHour: 32 });
    expect(sim.warEvents.mask).toBe(0xdd);
    expect(days(sim)).toEqual([0, 0, 101, 101, 0, 101, 100]);
    expect(sim.announcements).toEqual([{ day: 101, event: 4 }]);
    // Day 169 finds event 7 set: no change, no message.
    sim = ticks({ ...sim, clock: { day: 169, quarterHour: 31 } }, 1);
    expect(days(sim)).toEqual([0, 0, 101, 101, 0, 101, 100]);
    expect(sim.announcements).toEqual([{ day: 101, event: 4 }]);
  });

  test('event 7 set before 8 a.m. brings 3, 4 and 6 the same morning', () => {
    let sim = world(100, 31);
    sim = { ...sim, warEvents: setWarEvent(sim.warEvents, 7, 100) };
    sim = tickSim(sim);
    expect(sim.warEvents.mask).toBe(0xdd);
    expect(days(sim)).toEqual([0, 0, 100, 100, 0, 100, 100]);
  });

  test('a mobilised Théoden sets event 5, a mobilised Denethor event 3', () => {
    const sim = tickSim(
      world(10, 31, {
        [DENETHOR]: { allegiance: 99 },
        [THEODEN]: { allegiance: 99 }
      })
    );
    expect(sim.warEvents.mask).toBe(0x2d);
    expect(days(sim)).toEqual([0, 0, 10, 0, 10, 0, 0]);
    expect(sim.announcements).toEqual([]);
    // Allegiance 1 is not mobilised; any value above 1 is.
    expect(tickSim(world(10, 31)).warEvents.mask).toBe(0x05);
    expect(
      tickSim(world(10, 31, { [THEODEN]: { allegiance: 2 } })).warEvents.mask
    ).toBe(0x25);
  });

  test('Gandalf asleep with no trigger sets event 1, with no day', () => {
    const dead = tickSim(
      world(10, 31, { [GANDALF]: { state: 0, strength: 0, trigger_byte: 0 } })
    );
    expect(dead.warEvents.mask).toBe(0x07);
    expect(days(dead)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(dead.announcements).toEqual([]);
    // Waiting for event 6, or awake: no event 1.
    expect(tickSim(world(10, 31)).warEvents.mask).toBe(0x05);
    expect(
      tickSim(world(10, 31, { [GANDALF]: { state: 1, trigger_byte: 0 } }))
        .warEvents.mask
    ).toBe(0x05);
  });

  test('a set event keeps its first day', () => {
    const once = setWarEvent(INITIAL_WAR_EVENTS, 3, 10);
    expect(setWarEvent(once, 3, 20)).toBe(once);
    expect(once.days[3]).toBe(10);
    expect(INITIAL_WAR_EVENTS.mask).toBe(0x05);
  });
});

describe('war events with fights and saves', () => {
  const fight: Fight = {
    events: [],
    evil: 0,
    good: 0,
    position: { x: 0, y: 0 },
    round: 0,
    rows: [],
    winner: null
  };

  test('a fight holds the clock, so the check runs once when it resumes', () => {
    const fighting = { ...world(149, 31), fight };
    expect(ticks(fighting, 5)).toBe(fighting);
    const resumed = tickSim({ ...fighting, fight: null, sweepFrom: 140 });
    expect(resumed.clock).toEqual({ day: 149, quarterHour: 32 });
    expect(resumed.announcements).toEqual([{ day: 149, event: 4 }]);
    expect(tickSim(resumed).announcements).toHaveLength(1);
  });

  test('save before the boundary, restore, play on: the same events', () => {
    const before = world(169, 30);
    const played = ticks(before, 2 + 96);
    const restored = restoreSave(serialiseSave(before), null);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(ticks(restored.state, 2 + 96)).toEqual(played);
  });

  test('a waiting announcement survives a save and is taken once', () => {
    const sim = ticks(world(149, 31), 1);
    const restored = restoreSave(serialiseSave(sim), null);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    const first = takeAnnouncements(restored.state);
    expect(first.announcements).toEqual([{ day: 149, event: 4 }]);
    expect(takeAnnouncements(first.state).announcements).toEqual([]);
    // Taken before saving: the restored game does not show it again.
    const again = restoreSave(serialiseSave(first.state), null);
    expect(again.ok && again.state.announcements).toEqual([]);
  });
});
