import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { resolveFight } from './combat';
import { createSim, tickSim, type SimState } from './state';

// The Isen Ford and Mordor tripwires (docs/spec/war-events.md,
// "Tripwires"), with the set-ups of docs/re/war-events-reference.md:
// a Leader one pixel short of a tile origin, facing it. Every other
// entry sleeps without strength.

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
  ticked: index > 0 && index <= 151,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

const EAST = 2;

// A Leader at `from`, facing east, heading for the next tile origin.
const stepper = (
  allegiance: number,
  from: { x: number; y: number },
  to: { x: number; y: number }
) => ({
  allegiance,
  destination: to,
  facing: EAST,
  position: from,
  state: 1,
  strength: 150
});

const world = (
  clock: { day: number; quarterHour: number },
  overrides: Record<number, Record<string, unknown>>
): SimState =>
  createSim(1, {
    clock: { day: clock.day, quarter_hour: clock.quarterHour },
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
    // Gandalf waits for event 6, as at the start, so event 1 stays clear.
    roster: Array.from({ length: 152 }, (_, index) =>
      entry(index, {
        ...(index === 1 ? { trigger_byte: 0x40 } : {}),
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

const NOON = { day: 10, quarterHour: 50 };
const days = (sim: SimState): number[] => sim.warEvents.days.slice(1);

describe('the Isen Ford', () => {
  test('an Evil Leader landing on it sets events 3 and 5, silently', () => {
    const sim = tickSim(
      world(NOON, {
        88: stepper(0, { x: 1103, y: 928 }, { x: 1104, y: 928 })
      })
    );
    expect(sim.roster[88]!.position).toEqual({ x: 1104, y: 928 });
    expect(sim.warEvents.mask).toBe(0x2d);
    expect(days(sim)).toEqual([0, 0, 10, 0, 10, 0, 0]);
    expect(sim.announcements).toEqual([]);
  });

  test("Gondor wakes that sweep or the next; Rohan's musters at 8 a.m.", () => {
    let sim = world(NOON, {
      28: { strength: 1, trigger_byte: 0x20 },
      32: { state: 1, strength: 1, trigger_byte: 0x08 },
      88: stepper(0, { x: 1103, y: 928 }, { x: 1104, y: 928 }),
      90: { strength: 1, trigger_byte: 0x08 }
    });
    sim = tickSim(sim);
    // Entry 90 comes after the Orcs in the sweep; Denethor before them.
    expect(sim.roster[90]!.state).toBe(1);
    expect(sim.roster[32]!.allegiance).toBe(1);
    sim = tickSim(sim);
    expect(sim.roster[32]!.allegiance).toBe(99);
    sim = ticks(sim, 96 - 52 + 32);
    expect(sim.clock).toEqual({ day: 11, quarterHour: 32 });
    expect(sim.roster[28]!.state).toBe(0);
    sim = tickSim(sim);
    expect(sim.roster[28]).toMatchObject({ allegiance: 99, state: 1 });
  });

  test('a non-Evil Leader on the ford, or an Evil one between tile origins, sets nothing', () => {
    const good = tickSim(
      world(NOON, {
        57: stepper(99, { x: 1103, y: 928 }, { x: 1104, y: 928 })
      })
    );
    expect(good.warEvents.mask).toBe(0x05);
    const passing = tickSim(
      world(NOON, {
        88: stepper(0, { x: 1102, y: 928 }, { x: 1120, y: 928 })
      })
    );
    expect(passing.roster[88]!.position).toEqual({ x: 1103, y: 928 });
    expect(passing.warEvents.mask).toBe(0x05);
  });

  test('a later crossing leaves the first day', () => {
    let sim = tickSim(
      world(NOON, {
        88: stepper(0, { x: 1103, y: 928 }, { x: 1104, y: 928 })
      })
    );
    sim = {
      ...sim,
      clock: { day: 20, quarterHour: 50 },
      roster: sim.roster.map(e =>
        e.index === 88
          ? {
              ...e,
              ...stepper(0, { x: 1103, y: 928 }, { x: 1104, y: 928 })
            }
          : e
      )
    };
    sim = tickSim(sim);
    expect(sim.roster[88]!.position).toEqual({ x: 1104, y: 928 });
    expect(days(sim)).toEqual([0, 0, 10, 0, 10, 0, 0]);
  });
});

describe('the approaches to Mordor', () => {
  test('a non-Evil Leader at or beyond (1664, 1008) sets event 7, silently', () => {
    let sim = tickSim(
      world(NOON, {
        5: stepper(99, { x: 1663, y: 1008 }, { x: 1664, y: 1008 })
      })
    );
    expect(sim.warEvents.mask).toBe(0x85);
    expect(days(sim)).toEqual([0, 0, 0, 0, 0, 0, 10]);
    expect(sim.announcements).toEqual([]);
    // The next 8 a.m. brings 3, 4 and 6, and Saruman's announcement.
    sim = ticks(sim, 96 - 51 + 32);
    expect(sim.clock).toEqual({ day: 11, quarterHour: 32 });
    expect(sim.warEvents.mask).toBe(0xdd);
    expect(days(sim)).toEqual([0, 0, 11, 11, 0, 11, 10]);
    expect(sim.announcements).toEqual([{ day: 11, event: 4 }]);
    // Day 169 finds event 7 set: no Dark Lord announcement.
    sim = ticks({ ...sim, clock: { day: 169, quarterHour: 31 } }, 1);
    expect(sim.announcements).toEqual([{ day: 11, event: 4 }]);
  });

  test('west or north of the corner, or an Evil Leader, sets nothing', () => {
    for (const [allegiance, from, to] of [
      [99, { x: 1647, y: 1008 }, { x: 1648, y: 1008 }],
      [99, { x: 1663, y: 992 }, { x: 1664, y: 992 }],
      [0, { x: 1663, y: 1008 }, { x: 1664, y: 1008 }]
    ] as const) {
      const sim = tickSim(world(NOON, { 5: stepper(allegiance, from, to) }));
      expect(sim.roster[5]!.position).toEqual(to);
      expect(sim.warEvents.mask).toBe(0x05);
    }
  });
});

const startingStatePath = new URL(
  '../../public/assets/starting-state.json',
  import.meta.url
);
const tilemapPath = new URL(
  '../../public/assets/campaign/tilemap.json',
  import.meta.url
);
const consumed = (before: SimState, after: SimState): number[] =>
  after.roster
    .filter(
      e => e.triggerByte === 0 && before.roster[e.index]!.triggerByte !== 0
    )
    .map(e => e.index);

describe.skipIf(!existsSync(startingStatePath) || !existsSync(tilemapPath))(
  'on the Reference Build roster',
  () => {
    test('Evil at the Isen Ford mobilises Gondor, then the 0-day Rohan musters', () => {
      const start = createSim(
        1,
        JSON.parse(readFileSync(startingStatePath, 'utf8')),
        JSON.parse(readFileSync(tilemapPath, 'utf8'))
      );
      const before: SimState = {
        ...start,
        clock: NOON,
        roster: start.roster.map(e =>
          e.index === 88
            ? {
                ...e,
                ...stepper(0, { x: 1103, y: 928 }, { x: 1104, y: 928 }),
                strength: e.strength,
                trigger: { kind: 'none' },
                triggerByte: 0
              }
            : e
        )
      };
      // The Orcs land on Théodred at the ford: the fight holds the
      // sweep, as in the reference run, and is resolved before it goes on.
      const landed = tickSim(before);
      expect(landed.fight).not.toBeNull();
      expect(landed.warEvents.mask).toBe(0x2d);
      const sweeps = tickSim(tickSim(resolveFight(landed)));
      expect(sweeps.warEvents.mask).toBe(0x2d);
      expect(consumed(before, sweeps)).toEqual([
        32, 42, 45, 47, 49, 51, 54, 69, 70, 71, 72, 73, 74, 75, 76, 77
      ]);
      const morning = ticks(sweeps, 96 - 52 + 33);
      expect(
        consumed(sweeps, morning).filter(i => [28, 30, 35, 36].includes(i))
      ).toEqual([28, 30, 35]);
    });
  }
);
