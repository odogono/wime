import { describe, expect, test } from 'bun:test';

import {
  RIVENDELL,
  closeCouncil,
  councilDue,
  dayAfterCouncil,
  holdCouncil
} from './council';
import { BILBO, meetsEncounter } from './encounters';
import { restoreSave, serialiseSave } from './save';
import { createSim, tickSim, watchEntry, type SimState } from './state';

// The Council of Elrond on synthetic rosters
// (docs/spec/council-of-elrond.md). Entries sit at their real roster
// indices; every other index is an empty, sleeping entry. No map is
// loaded, so nothing moves.

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  health: 1,
  icon: 0,
  index: 0,
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
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

const GANDALF_WAITING = { x: 1216, y: 380 };
const ELSEWHERE = { x: 640, y: 368 };

// Gandalf asleep where he waits, with Rivendell as his destination and
// his event 6 trigger, as at the start.
const gandalf = (over: Record<string, unknown> = {}) => ({
  destination: RIVENDELL,
  index: 1,
  name: 'GANDALF',
  position: GANDALF_WAITING,
  trigger: { days_after: 0, event_bit: 6, kind: 'delayed' },
  trigger_byte: 0x60,
  ...over
});

// Frodo, the Ring-bearer, leading his Force on Rivendell.
const frodo = (over: Record<string, unknown> = {}) => ({
  health: 3,
  index: 7,
  max_health: 7,
  name: 'FRODO',
  position: RIVENDELL,
  state: 1,
  ...over
});

const world = (
  entries: Record<string, unknown>[],
  { day = 20, quarterHour = 63, ringBearer = 7 } = {}
): SimState => {
  const roster = Array.from({ length: 196 }, (_, index) =>
    entry({ index, ticked: index > 0 && index < 152 })
  );
  roster[BILBO] = entry({
    encounter: {
      area: { bottom: 384, left: 1216, right: 1216, top: 384 },
      chance: 0,
      earliest_day: 0
    },
    index: BILBO,
    name: 'BILBO',
    ticked: false
  });
  for (const over of entries) {
    roster[over.index as number] = entry(over);
  }
  return createSim(1, {
    clock: { day, quarter_hour: quarterHour },
    events: { ring_bearer: ringBearer },
    place_kinds: [],
    places: [
      {
        announces_attacks: false,
        grid_byte: 0,
        grid_reference: null,
        index: 1,
        name: 'RIVENDELL',
        position: RIVENDELL,
        tile: { x: 76, y: 24 },
        tile_kind: null
      }
    ],
    roster,
    routes: []
  });
};

// The Ring-bearer's Force at Rivendell with Gandalf waiting there, one
// quarter-hour before the hour.
const arrival = (
  entries: Record<string, unknown>[] = [],
  options: Parameters<typeof world>[1] = {}
): SimState => world([gandalf(), frodo(), ...entries], options);

describe('when the Council is held', () => {
  test('on the hour the Ring-bearer stands at Rivendell with Gandalf', () => {
    const held = tickSim(arrival());
    expect(held.clock.quarterHour).toBe(64);
    expect(held.councilPending).toBe(false);
    expect(held.council).toEqual({ ringBearer: 7 });
  });

  test('only on the hour', () => {
    const sim = arrival([], { quarterHour: 64 });
    const stepped = tickSim(sim);
    expect(stepped.clock.quarterHour).toBe(65);
    expect(stepped.councilPending).toBe(true);
    expect(stepped.council).toBeNull();
  });

  test('with Gandalf on Rivendell itself', () => {
    const sim = world([gandalf({ position: RIVENDELL }), frodo()]);
    expect(tickSim(sim).council).toEqual({ ringBearer: 7 });
  });

  test('by the Leader of the Ring-bearer’s Force', () => {
    const sim = world([
      gandalf(),
      frodo({ leader: 5, position: null }),
      { index: 5, name: 'ARAGORN', position: RIVENDELL, state: 1 }
    ]);
    expect(tickSim(sim).council).toEqual({ ringBearer: 7 });
  });

  test('not with the Ring-bearer elsewhere', () => {
    const sim = world([gandalf(), frodo({ position: ELSEWHERE })]);
    expect(tickSim(sim).council).toBeNull();
  });

  test('not with Gandalf elsewhere, or following someone', () => {
    expect(
      tickSim(world([gandalf({ position: ELSEWHERE }), frodo()])).council
    ).toBeNull();
    expect(
      tickSim(world([gandalf({ leader: 7, position: null }), frodo()])).council
    ).toBeNull();
  });

  test('whether Gandalf is alive or not', () => {
    const sim = world([gandalf({ strength: 0 }), frodo()]);
    expect(tickSim(sim).council).toEqual({ ringBearer: 7 });
  });

  test('not while the Animation Level watches an entry', () => {
    const sim = watchEntry(arrival(), 7);
    expect(tickSim(sim).council).toBeNull();
  });

  test('only once', () => {
    const held = closeCouncil(tickSim(arrival()));
    const later = { ...held, clock: { ...held.clock, quarterHour: 67 } };
    expect(
      councilDue({ ...later, clock: { ...later.clock, quarterHour: 68 } })
    ).toBe(false);
    expect(tickSim(later).council).toBeNull();
  });

  test('before the 8 a.m. daily check', () => {
    // Gandalf dead and asleep with no trigger: the daily check sets
    // event 1. The Council wakes no one when he is dead, so the check
    // still sees him asleep.
    const sim = world(
      [
        gandalf({ strength: 0, trigger: { kind: 'none' }, trigger_byte: 0 }),
        frodo()
      ],
      { quarterHour: 31 }
    );
    const held = tickSim(sim);
    expect(held.council).not.toBeNull();
    expect(held.warEvents.mask & 0x02).toBe(0x02);
  });
});

describe('the calendar', () => {
  test('moves on 60 days before day 32, 10 after day 82, else to 92', () => {
    expect(dayAfterCouncil(0)).toBe(60);
    expect(dayAfterCouncil(31)).toBe(91);
    expect(dayAfterCouncil(32)).toBe(92);
    expect(dayAfterCouncil(82)).toBe(92);
    expect(dayAfterCouncil(83)).toBe(93);
  });

  test('keeps the quarter-hour', () => {
    const held = tickSim(arrival([], { day: 40 }));
    expect(held.clock).toEqual({ day: 92, quarterHour: 64 });
  });
});

// Frodo and his followers, Aragorn and Boromir at Rivendell; Merry
// elsewhere.
const fellowship = (): SimState =>
  arrival([
    { health: 1, index: 5, max_health: 6, position: RIVENDELL, state: 1 },
    { health: 1, index: 6, leader: 5, max_health: 5 },
    { health: 1, index: 8, leader: 7, max_health: 5 },
    { health: 1, index: 9, max_health: 5, position: ELSEWHERE, state: 1 },
    { health: 1, index: 10, leader: 7, max_health: 5 }
  ]);

describe('the Fellowship', () => {
  test('heals entries 5 to 10 whose Force stands on Rivendell', () => {
    const { roster } = tickSim(fellowship());
    expect([5, 6, 7, 8, 9, 10].map(i => roster[i]!.health)).toEqual([
      6, 5, 7, 5, 1, 5
    ]);
  });

  test('puts them under Gandalf, save Frodo’s followers', () => {
    const { roster } = tickSim(fellowship());
    expect([5, 6, 7, 8, 9, 10].map(i => roster[i]!.leader)).toEqual([
      1,
      1,
      1,
      7,
      null,
      7
    ]);
  });

  test('wakes Gandalf and clears his trigger', () => {
    const gandalf = tickSim(fellowship()).roster[1]!;
    expect(gandalf.state).toBe(1);
    expect(gandalf.trigger).toEqual({ kind: 'none' });
    expect(gandalf.triggerByte).toBe(0);
  });

  test('finds each Force with the changes made so far', () => {
    // Frodo, taken before Aragorn, joins Gandalf, who still waits at
    // (1216, 380), so Aragorn's Force is no longer on Rivendell.
    const sim = arrival([{ health: 1, index: 5, leader: 7, max_health: 6 }]);
    const aragorn = tickSim(sim).roster[5]!;
    expect(aragorn.health).toBe(1);
    expect(aragorn.leader).toBe(7);
  });

  test('with Gandalf dead, heals but joins no one to him', () => {
    const sim = world([
      gandalf({ strength: 0 }),
      frodo(),
      { health: 1, index: 5, max_health: 6, position: RIVENDELL, state: 1 }
    ]);
    const { roster } = tickSim(sim);
    expect(roster[5]).toMatchObject({ health: 6, leader: null });
    expect(roster[7]).toMatchObject({ health: 7, leader: null });
    expect(roster[1]!.state).toBe(0);
  });

  test('puts the Ring-bearer under Gandalf wherever he is in the roster', () => {
    const sim = world(
      [
        gandalf(),
        { index: 26, name: 'THEODEN', position: RIVENDELL, state: 1 }
      ],
      { ringBearer: 26 }
    );
    expect(tickSim(sim).roster[26]!.leader).toBe(1);
  });
});

describe('the Ring-bearer', () => {
  test('Gimli takes over from Elrond or Glorfindel, by name only', () => {
    for (const bearer of [3, 4]) {
      const sim = world(
        [
          gandalf(),
          { index: bearer, objects: [0], position: RIVENDELL, state: 1 },
          { index: 12, leader: 1, name: 'GIMLI' }
        ],
        { ringBearer: bearer }
      );
      const held = tickSim(sim);
      expect(held.ringBearer).toBe(12);
      expect(held.council).toEqual({ ringBearer: 12 });
      expect(held.roster[bearer]!.objects).toEqual([0]);
      expect(held.roster[12]!.objects).toEqual([]);
    }
  });

  test('Elrond and Glorfindel are put to sleep', () => {
    const sim = arrival([
      {
        index: 3,
        position: RIVENDELL,
        state: 1,
        trigger: { event_bit: 3, kind: 'on-event' },
        trigger_byte: 0x08
      },
      { index: 4, position: ELSEWHERE, state: 1 }
    ]);
    const { roster } = tickSim(sim);
    expect(roster[3]).toMatchObject({ state: 0, triggerByte: 0x08 });
    expect(roster[4]!.state).toBe(0);
  });
});

describe('the rest of the world', () => {
  test('the Nazgûl are put to sleep for good', () => {
    const nazgul = Array.from({ length: 9 }, (_, i) => ({
      index: 79 + i,
      position: ELSEWHERE,
      state: 1,
      trigger: { event_bit: 0, kind: 'near-ring-bearer' },
      trigger_byte: 1
    }));
    const { roster } = tickSim(arrival(nazgul));
    for (let index = 79; index <= 87; index++) {
      expect(roster[index]).toMatchObject({
        state: 0,
        trigger: { kind: 'none' },
        triggerByte: 0
      });
    }
  });

  test('Bilbo can be met after the Council', () => {
    const held = closeCouncil(tickSim(arrival()));
    const bilbo = held.roster[BILBO]!;
    expect(bilbo.encounter!.chance).toBe(100);
    // Any roll out of 50 is within a chance of 100.
    const met = { ...held, terrainByTile: [], tilemap: null };
    expect(meetsEncounter(met, met.roster[7]!, bilbo)).toBe(true);
  });

  test('every Leader up to entry 150 is put at its destination', () => {
    const goal = { x: 800, y: 600 };
    const { roster } = tickSim(
      arrival([
        { destination: goal, index: 20, position: ELSEWHERE },
        { destination: goal, index: 21, leader: 20 },
        { destination: { x: 0, y: 600 }, index: 22, position: ELSEWHERE },
        { destination: goal, index: 150, position: ELSEWHERE },
        { destination: goal, index: 151, position: ELSEWHERE }
      ])
    );
    expect(roster[20]).toMatchObject({ destination: goal, position: goal });
    expect(roster[21]!.position).toBeNull();
    expect(roster[22]!.position).toEqual(ELSEWHERE);
    expect(roster[150]!.position).toEqual(goal);
    expect(roster[151]!.position).toEqual(ELSEWHERE);
  });

  test('Gandalf ends on Rivendell', () => {
    expect(tickSim(arrival()).roster[1]!.position).toEqual(RIVENDELL);
  });
});

describe('the message', () => {
  test('holds game time until the view closes it', () => {
    const held = tickSim(arrival());
    expect(tickSim(held)).toBe(held);
    const closed = closeCouncil(held);
    expect(closed.council).toBeNull();
    expect(tickSim(closed).clock.quarterHour).toBe(65);
  });

  test('survives a save', () => {
    const held = tickSim(arrival());
    const restored = restoreSave(serialiseSave(held), null);
    expect(restored).toEqual({ ok: true, state: held });
  });

  test('holdCouncil leaves the message naming the Ring-bearer', () => {
    expect(holdCouncil(arrival()).council).toEqual({ ringBearer: 7 });
  });
});
