import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { answerMeeting } from './meetings';
import { canOrder } from './movement';
import { restoreSave, serialiseSave } from './save';
import { forcesOnMap } from './starting-state';
import { createSim, tickSim, type SimState } from './state';
import { loadTerrainRegions, terrainGridFrom } from './terrain';
import { setWarEvent } from './war-events';

// Waking and mobilising on a synthetic roster (docs/spec/war-events.md,
// "Triggers"), with the set-ups of docs/re/war-events-reference.md.
// Entries default to asleep, unmobilised and without strength, so only
// the entries a test sets up can wake or move.

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

const place = (index: number, name: string, x: number, y: number) => ({
  announces_attacks: false,
  grid_byte: 0,
  grid_reference: null,
  index,
  name,
  position: { x, y },
  tile: { x: Math.floor(x / 16), y: Math.floor(y / 16) },
  tile_kind: null
});

const LINHIR = place(56, 'LINHIR', 1360, 1312);
const MINAS_TIRITH = place(45, 'MINAS TIRITH', 1616, 1184);

// A living entry: strength and health 1.
const alive = (over: Record<string, unknown> = {}) => ({
  strength: 1,
  ...over
});

const world = (
  clock: { day: number; quarterHour: number },
  overrides: Record<number, Record<string, unknown>>,
  routes: number[][] = []
): SimState =>
  createSim(1, {
    clock: { day: clock.day, quarter_hour: clock.quarterHour },
    events: { ring_bearer: 7 },
    place_kinds: [],
    places: [LINHIR, MINAS_TIRITH],
    roster: Array.from({ length: 196 }, (_, index) =>
      entry(index, overrides[index])
    ),
    routes: routes.map(places => ({ places }))
  });

// Route rows by number, every other row empty.
const dense = (rows: Record<number, number[]>): number[][] =>
  Array.from({ length: 86 }, (_, row) => rows[row] ?? []);

// Play until the clock has moved n quarter-hours, answering any meeting
// as the view's default does.
const playQuarterHours = (state: SimState, n: number): SimState => {
  let next = state;
  const until = state.clock.quarterHour + n;
  while (next.clock.quarterHour < until) {
    next = next.meeting
      ? answerMeeting(next, 'continue-on').world
      : tickSim(next);
  }
  return next;
};

const ticks = (state: SimState, n: number): SimState => {
  let next = state;
  for (let i = 0; i < n; i++) {
    next = tickSim(next);
  }
  return next;
};

const withEvent = (sim: SimState, bit: number, day: number): SimState => ({
  ...sim,
  warEvents: setWarEvent(sim.warEvents, bit, day)
});

const NOON = { day: 10, quarterHour: 50 };

// Aragorn (5) asleep at (784, 380); Frodo (7), the Ring-bearer, halted.
const near = (frodo: { x: number; y: number }) =>
  tickSim(
    world(NOON, {
      5: alive({ position: { x: 784, y: 380 }, trigger_byte: 0x01 }),
      7: alive({ position: frodo, state: 1 })
    })
  ).roster[5]!;

const awake = (sim: SimState) =>
  [28, 36, 38, 40].filter(index => sim.roster[index]!.state === 1);

describe('near the Ring-bearer', () => {
  test('9 pixels on both axes wakes, 10 on either does not', () => {
    expect(near({ x: 793, y: 389 })).toMatchObject({
      state: 1,
      triggerByte: 0
    });
    expect(near({ x: 775, y: 371 }).state).toBe(1);
    expect(near({ x: 794, y: 380 })).toMatchObject({
      state: 0,
      triggerByte: 1
    });
    expect(near({ x: 784, y: 390 }).state).toBe(0);
  });

  test("a following Ring-bearer is where its Force's Leader is", () => {
    const sim = tickSim(
      world(NOON, {
        5: alive({ position: { x: 784, y: 380 }, trigger_byte: 0x01 }),
        7: alive({ leader: 8, position: null, state: 1 }),
        8: alive({ position: { x: 775, y: 371 }, state: 1 })
      })
    );
    expect(sim.roster[5]!.state).toBe(1);
  });
});

describe('near Gandalf', () => {
  // Théoden (26), awake but unmobilised, at (1248, 992).
  const theoden = alive({
    position: { x: 1248, y: 992 },
    state: 1,
    trigger_byte: 0x04
  });
  const mobilised = (gandalfs: Record<number, Record<string, unknown>>) =>
    tickSim(world(NOON, { 26: theoden, ...gandalfs })).roster[26]!.allegiance;

  test('either Gandalf, awake within 4 pixels on both axes', () => {
    expect(
      mobilised({ 1: alive({ position: { x: 1252, y: 996 }, state: 1 }) })
    ).toBe(99);
    expect(
      mobilised({ 1: alive({ position: { x: 1253, y: 992 }, state: 1 }) })
    ).toBe(1);
    // The second Gandalf counts too, resting or not.
    expect(
      mobilised({ 2: alive({ position: { x: 1244, y: 988 }, state: 3 }) })
    ).toBe(99);
  });

  test('a sleeping or dead Gandalf does not count', () => {
    expect(
      mobilised({ 1: alive({ position: { x: 1248, y: 992 }, state: 0 }) })
    ).toBe(1);
    expect(
      mobilised({
        1: { position: { x: 1248, y: 992 }, state: 0, strength: 0 }
      })
    ).toBe(1);
  });
});

describe('event triggers', () => {
  test('an immediate event wakes in the sweep that sees it, at any hour', () => {
    // Event 3 at noon: Denethor (32), awake, route 0; Imrahil (42), awake,
    // route to Linhir then Minas Tirith; Forlong (45), asleep, mobilised.
    const sim = tickSim(
      withEvent(
        world(
          NOON,
          {
            32: alive({
              position: { x: 1616, y: 1184 },
              state: 1,
              trigger_byte: 0x08
            }),
            42: alive({
              position: { x: 1168, y: 1296 },
              route: 16,
              state: 1,
              trigger_byte: 0x08
            }),
            45: alive({
              allegiance: 99,
              position: { x: 1600, y: 1200 },
              route: 17,
              trigger_byte: 0x08
            })
          },
          dense({ 16: [56, 45], 17: [45] })
        ),
        3,
        10
      )
    );
    expect(sim.roster[32]).toMatchObject({
      allegiance: 99,
      destination: null,
      state: 1,
      trigger: { kind: 'none' },
      triggerByte: 0
    });
    expect(sim.roster[42]).toMatchObject({
      allegiance: 99,
      destination: { x: 1360, y: 1312 },
      state: 1
    });
    expect(sim.routes[16]).toEqual([45]);
    expect(sim.roster[45]).toMatchObject({
      allegiance: 99,
      destination: { x: 1616, y: 1184 },
      state: 1
    });
    expect(sim.routes[17]).toEqual([]);
  });

  test('an event waiting for its delay wakes only at hour 8', () => {
    // Event 5 on day 8. Théodred (0x20) and Elfhelm (0x22) are due on
    // day 10, Grimbold (0x23) on day 11, Dunhere (0x24) on day 12.
    const musters = {
      28: alive({ trigger_byte: 0x20 }),
      36: alive({ trigger_byte: 0x22 }),
      38: alive({ trigger_byte: 0x23 }),
      40: alive({ trigger_byte: 0x24 })
    };
    // Day 10 at 7:45: the 7:45 sweep is too early.
    let sim = tickSim(
      withEvent(world({ day: 10, quarterHour: 31 }, musters), 5, 8)
    );
    expect(awake(sim)).toEqual([]);
    // The 8:00 sweep.
    sim = tickSim(sim);
    expect(awake(sim)).toEqual([28, 36]);
    // Not at 9:00 or later on day 10, then 8:00 on day 11.
    sim = ticks(sim, 95);
    expect(sim.clock).toEqual({ day: 11, quarterHour: 32 });
    expect(awake(sim)).toEqual([28, 36]);
    sim = tickSim(sim);
    expect(awake(sim)).toEqual([28, 36, 38]);
  });

  test('an event set by the 8 a.m. check wakes its 0-day entries that morning', () => {
    const sim = ticks(
      world(
        { day: 149, quarterHour: 31 },
        { 88: alive({ allegiance: 0, trigger_byte: 0x10 }) }
      ),
      2
    );
    expect(sim.warEvents.days[4]).toBe(149);
    expect(sim.roster[88]).toMatchObject({ allegiance: 0, state: 1 });
  });

  test('a delayed event set at noon waits for the next 8 a.m.', () => {
    let sim = withEvent(
      world(NOON, { 28: alive({ trigger_byte: 0x20 }) }),
      5,
      10
    );
    sim = ticks(sim, 96 - 50 + 32);
    expect(sim.clock).toEqual({ day: 11, quarterHour: 32 });
    expect(sim.roster[28]!.state).toBe(0);
    expect(tickSim(sim).roster[28]!.state).toBe(1);
  });
});

describe('what waking changes', () => {
  test('dead entries never wake and keep their trigger', () => {
    const sim = ticks(
      withEvent(
        world(NOON, {
          45: { health: 1, strength: 0, trigger_byte: 0x08 },
          46: { health: 0, strength: 1, trigger_byte: 0x08 }
        }),
        3,
        10
      ),
      3
    );
    expect(sim.roster[45]).toMatchObject({ state: 0, triggerByte: 0x08 });
    expect(sim.roster[46]).toMatchObject({ state: 0, triggerByte: 0x08 });
  });

  test('Evil keeps allegiance 0; other values above 1 are kept too', () => {
    const sim = tickSim(
      withEvent(
        world(NOON, {
          104: alive({ allegiance: 0, trigger_byte: 0x08 }),
          65: alive({ allegiance: 2, trigger_byte: 0x08 })
        }),
        3,
        10
      )
    );
    expect(sim.roster[65]).toMatchObject({ allegiance: 2, state: 1 });
    expect(sim.roster[104]).toMatchObject({ allegiance: 0, state: 1 });
  });

  test('a woken Leader takes its first step in the same tick', () => {
    const sim = tickSim(
      withEvent(
        world(
          NOON,
          {
            45: alive({
              allegiance: 99,
              position: { x: 1600, y: 1200 },
              route: 17,
              trigger_byte: 0x08
            })
          },
          dense({ 17: [45] })
        ),
        3,
        10
      )
    );
    expect(sim.roster[45]!.position).not.toEqual({ x: 1600, y: 1200 });
  });

  test('a woken follower takes its destination but stays put', () => {
    const sim = tickSim(
      withEvent(
        world(
          NOON,
          {
            44: alive({ position: { x: 1600, y: 1200 }, state: 1 }),
            45: alive({ leader: 44, route: 17, trigger_byte: 0x08 })
          },
          dense({ 17: [45] })
        ),
        3,
        10
      )
    );
    expect(sim.roster[45]).toMatchObject({
      destination: { x: 1616, y: 1184 },
      position: null,
      state: 1
    });
  });

  test('a trigger fires once: no second route stop, no override of a later Order', () => {
    let sim = tickSim(
      withEvent(
        world(
          NOON,
          { 42: alive({ route: 16, state: 1, trigger_byte: 0x08 }) },
          dense({ 16: [56, 45] })
        ),
        3,
        10
      )
    );
    expect(sim.routes[16]).toEqual([45]);
    const ordered = {
      ...sim,
      roster: sim.roster.map(entry =>
        entry.index === 42
          ? { ...entry, destination: { x: 100, y: 100 } }
          : entry
      )
    };
    sim = ticks(ordered, 3);
    expect(sim.routes[16]).toEqual([45]);
    expect(sim.roster[42]!.destination).toEqual({ x: 100, y: 100 });
  });

  test('a woken, mobilised Force is on the map and takes Orders', () => {
    const sleeping = withEvent(
      world(NOON, {
        45: alive({ position: { x: 1600, y: 1200 }, trigger_byte: 0x08 })
      }),
      3,
      10
    );
    expect(forcesOnMap(sleeping.roster).map(f => f.leader.index)).toEqual([]);
    expect(canOrder(sleeping, 45)).toBe(false);
    const woken = tickSim(sleeping);
    expect(forcesOnMap(woken.roster).map(f => f.leader.index)).toEqual([45]);
    expect(canOrder(woken, 45)).toBe(true);
  });

  test('Encounter figures are never woken', () => {
    const sim = tickSim(
      withEvent(world(NOON, { 160: alive({ trigger_byte: 0x08 }) }), 3, 10)
    );
    expect(sim.roster[160]).toMatchObject({ state: 0, triggerByte: 0x08 });
  });

  test('save, restore and play on across a wake-up: the same game', () => {
    const before = withEvent(
      world(
        { day: 10, quarterHour: 30 },
        {
          28: alive({ trigger_byte: 0x20 }),
          42: alive({ route: 16, state: 1, trigger_byte: 0x08 })
        },
        dense({ 16: [56, 45] })
      ),
      5,
      10
    );
    const played = ticks(before, 6);
    expect(played.roster[28]!.state).toBe(1);
    for (const at of [0, 3, 6]) {
      const saved = restoreSave(serialiseSave(ticks(before, at)), null);
      expect(saved.ok).toBe(true);
      if (saved.ok) {
        expect(ticks(saved.state, 6 - at)).toEqual(played);
      }
    }
  });
});

// The Reference Build's roster, when the exported starting state is
// present (it is gitignored and absent in CI).
const startingStatePath = new URL(
  '../../public/assets/starting-state.json',
  import.meta.url
);
const terrainPath = new URL(
  '../../public/assets/geography/terrain-regions.json',
  import.meta.url
);
const start = (): SimState =>
  createSim(
    1,
    JSON.parse(readFileSync(startingStatePath, 'utf8')),
    terrainGridFrom(
      loadTerrainRegions(JSON.parse(readFileSync(terrainPath, 'utf8')))
    )
  );

// Which entries' triggers were consumed between two states.
const woken = (before: SimState, after: SimState): number[] =>
  after.roster
    .filter(
      entry =>
        entry.triggerByte === 0 && before.roster[entry.index]!.triggerByte !== 0
    )
    .map(entry => entry.index);

describe.skipIf(!existsSync(startingStatePath) || !existsSync(terrainPath))(
  'the reference musters',
  () => {
    test('Théoden and Denethor mobilised: Rohan and Gondor at 8 a.m.', () => {
      const before = start();
      const set = {
        ...before,
        clock: { day: 10, quarterHour: 31 },
        roster: before.roster.map(entry =>
          entry.index === 26 || entry.index === 32
            ? { ...entry, allegiance: 99 }
            : entry
        )
      };
      // On the real map the newly woken Forces meet as they muster;
      // answering lets the 8 a.m. sweep run on to the last of them.
      const after = playQuarterHours(set, 2);
      expect(after.warEvents.mask).toBe(0x2d);
      expect(woken(set, after)).toEqual([
        28, 30, 32, 35, 42, 45, 47, 49, 51, 54, 69, 70, 71, 72, 73, 74, 75, 76,
        77
      ]);
      expect(after.roster[42]).toMatchObject({
        allegiance: 99,
        destination: { x: 1360, y: 1312 }
      });
      expect(after.routes[16]).toEqual([57, 45]);
      expect(after.roster[36]!.triggerByte).toBe(0x22);
    });

    test('day 169: the 0-day Evil armies and Sauron', () => {
      const before = { ...start(), clock: { day: 169, quarterHour: 31 } };
      const after = ticks(before, 2);
      expect(woken(before, after)).toEqual([97, 106, 108, 129, 150]);
      for (const index of [97, 106, 108, 129, 150]) {
        expect(after.roster[index]).toMatchObject({ allegiance: 0, state: 1 });
      }
    });
  }
);
