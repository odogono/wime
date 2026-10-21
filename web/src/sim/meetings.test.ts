import { describe, expect, test } from 'bun:test';

import { answerMeeting } from './meetings';
import { giveOrder } from './movement';
import { restoreSave, serialiseSave } from './save';
import { createSim, tickSim, type SimState } from './state';

// Meetings on synthetic rosters (docs/spec/forces.md), set up as the
// Reference runs of docs/re/forces-reference.md: one Leader one pixel short
// of another's tile origin, heading for it. Entries sit at their real
// roster indices; every other index is an empty, sleeping entry.

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

// A Leader standing awake at a tile origin, with no destination.
const standing = (
  index: number,
  name: string,
  x: number,
  y: number,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  index,
  name,
  position: { x, y },
  state: 3,
  ...over
});

// A Leader one pixel south of (x, y), heading for it.
const arriving = (
  index: number,
  name: string,
  x: number,
  y: number,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  destination: { x, y },
  index,
  name,
  position: { x, y: y + 1 },
  state: 1,
  ...over
});

const world = (entries: Record<string, unknown>[]): SimState => {
  const roster = Array.from({ length: 152 }, (_, index) =>
    entry({ index, ticked: index > 0 })
  );
  for (const over of entries) {
    roster[over.index as number] = entry(over);
  }
  return createSim(1, {
    clock: { day: 1, quarter_hour: 70 },
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
    roster,
    routes: []
  });
};

// forces-meet-mobilised-characters
const faramirOntoEomer = (): SimState =>
  world([
    standing(13, 'EOMER', 1360, 960),
    arriving(15, 'FARAMIR', 1360, 960),
    entry({
      index: 16,
      is_unit: true,
      leader: 15,
      name: 'Rangers',
      starting_strength: 200,
      state: 1,
      strength: 200
    })
  ]);

describe('when a meeting happens', () => {
  test('two mobilised Characters: the mover is offered to follow, both stop, the clock holds', () => {
    const sim = tickSim(faramirOntoEomer());
    expect(sim.meeting).toEqual({ a: 15, b: 13, kind: 'follow' });
    expect(sim.roster[13]!.state).toBe(2);
    expect(sim.roster[15]!.state).toBe(2);
    expect(sim.roster[15]!.position).toEqual({ x: 1360, y: 960 });
    expect(sim.clock).toEqual({ day: 1, quarterHour: 70 });
    expect(sim.sweepFrom).toBe(16);
    expect(tickSim(sim)).toBe(sim);
  });

  test('two mobilised Units: the higher roster index is A', () => {
    const infantry = { is_unit: true, starting_strength: 1000, strength: 1000 };
    const sim = tickSim(
      world([
        standing(72, 'infantry', 1344, 1200, { ...infantry, strength: 800 }),
        arriving(73, 'infantry', 1344, 1200, infantry)
      ])
    );
    expect(sim.meeting).toEqual({ a: 73, b: 72, kind: 'follow' });
  });

  test('a mobilised Leader is A even when the other has the higher index', () => {
    const sim = tickSim(
      world([
        standing(26, 'THEODEN', 1248, 992, { allegiance: 1 }),
        arriving(15, 'FARAMIR', 1248, 992)
      ])
    );
    expect(sim.meeting).toEqual({ a: 15, b: 26, kind: 'plain' });
  });

  test('an advisor invites A to talk, and the Leaders keep their states', () => {
    const sim = tickSim(
      world([
        standing(3, 'ELROND', 1216, 384, { allegiance: 3 }),
        arriving(5, 'ARAGORN', 1216, 384)
      ])
    );
    expect(sim.meeting).toEqual({ a: 5, b: 3, kind: 'talk' });
    // Aragorn rests on arriving; neither is stopped for the window.
    expect(sim.roster[3]!.state).toBe(3);
    expect(sim.roster[5]!.state).toBe(3);
    expect(sim.clock).toEqual({ day: 1, quarterHour: 70 });
  });
});

describe('when a meeting does not happen', () => {
  test('two unmobilised Leaders pass by and the clock goes on', () => {
    const sim = tickSim(
      world([
        standing(26, 'THEODEN', 1248, 992, { allegiance: 1 }),
        arriving(28, 'THEODRED', 1248, 992, { allegiance: 1 })
      ])
    );
    expect(sim.meeting).toBeNull();
    expect(sim.clock).toEqual({ day: 1, quarterHour: 71 });
  });

  test('the search goes on past them to an enemy', () => {
    const sim = tickSim(
      world([
        standing(26, 'THEODEN', 1248, 992, { allegiance: 1 }),
        arriving(28, 'THEODRED', 1248, 992, { allegiance: 1 }),
        standing(142, 'orcs', 1248, 992, {
          allegiance: 0,
          is_unit: true,
          starting_strength: 500,
          strength: 500
        })
      ])
    );
    expect(sim.meeting).toBeNull();
    expect(sim.fight).toMatchObject({ evil: 142, good: 28 });
  });

  test('a Leader that follows someone is not met', () => {
    const sim = tickSim(
      world([
        standing(13, 'EOMER', 1360, 960, { leader: 12 }),
        standing(12, 'EOMER', 1600, 960),
        arriving(15, 'FARAMIR', 1360, 960)
      ])
    );
    expect(sim.meeting).toBeNull();
  });
});

describe('answering', () => {
  test('Follow: A follows B, both set off, A keeps its place and its followers', () => {
    const met = tickSim(faramirOntoEomer());
    const { gollumSneaksAway, world: sim } = answerMeeting(met, 'follow');
    expect(gollumSneaksAway).toBe(false);
    expect(sim.meeting).toBeNull();
    expect(sim.roster[15]).toEqual({
      ...met.roster[15]!,
      leader: 13,
      state: 1
    });
    expect(sim.roster[15]!.position).toEqual({ x: 1360, y: 960 });
    expect(sim.roster[13]!.state).toBe(1);
    expect(sim.roster[16]!.leader).toBe(15);
    expect(tickSim(sim).clock).toEqual({ day: 1, quarterHour: 71 });
  });

  test('Continue on, or no answer: both set off and no Leader changes', () => {
    const { world: sim } = answerMeeting(
      tickSim(faramirOntoEomer()),
      'continue-on'
    );
    expect(sim.meeting).toBeNull();
    expect(sim.roster[13]).toMatchObject({ leader: null, state: 1 });
    expect(sim.roster[15]).toMatchObject({ leader: null, state: 1 });
  });

  test('Follow is not offered by the other kinds', () => {
    const met = tickSim(
      world([
        standing(3, 'ELROND', 1216, 384, { allegiance: 3 }),
        arriving(5, 'ARAGORN', 1216, 384)
      ])
    );
    const { world: sim } = answerMeeting(met, 'follow');
    expect(sim.roster[5]!.leader).toBeNull();
  });

  test('Gollum sneaks away when his chain now ends at a Wizard', () => {
    const met = tickSim(
      world([
        standing(1, 'GANDALF', 1200, 640, { facing: 5, figure: 4 }),
        arriving(7, 'FRODO', 1200, 640),
        entry({ index: 78, leader: 7, name: 'GOLLUM', state: 1 })
      ])
    );
    expect(met.meeting).toEqual({ a: 7, b: 1, kind: 'follow' });
    const { gollumSneaksAway, world: sim } = answerMeeting(met, 'follow');
    expect(gollumSneaksAway).toBe(true);
    expect(sim.roster[7]!.leader).toBe(1);
    expect(sim.roster[78]).toMatchObject({
      facing: 5,
      leader: null,
      position: { x: 1200, y: 640 }
    });
  });
});

describe('saving', () => {
  test('a pending meeting survives save and restore', () => {
    const met = tickSim(faramirOntoEomer());
    const restored = restoreSave(serialiseSave(met), met.tilemap);
    expect(restored).toEqual({ ok: true, state: met });
    if (!restored.ok) {
      return;
    }
    expect(answerMeeting(restored.state, 'follow')).toEqual(
      answerMeeting(met, 'follow')
    );
  });
});

// A save restores to the same state, and play continues the same
// way from it.
const roundTrip = (sim: SimState, ticks: number): SimState => {
  const restored = restoreSave(serialiseSave(sim), sim.tilemap);
  expect(restored).toEqual({ ok: true, state: sim });
  let played = sim;
  let replayed = restored.ok ? restored.state : sim;
  for (let i = 0; i < ticks; i++) {
    played = tickSim(played);
    replayed = tickSim(replayed);
  }
  expect(replayed).toEqual(played);
  return played;
};

describe('saving formed and split Forces', () => {
  test('a Force formed by following, then split by an Order, survives save and restore', () => {
    let sim = tickSim(faramirOntoEomer());
    sim = roundTrip(sim, 0);
    sim = answerMeeting(sim, 'follow').world;
    expect(sim.roster[15]!.leader).toBe(13);
    sim = roundTrip(sim, 20);
    expect(sim.roster[15]!.leader).toBe(13);
    sim = giveOrder(sim, 15, { x: 1500, y: 960 });
    expect(sim.roster[15]!.leader).toBeNull();
    expect(sim.roster[16]!.leader).toBe(15);
    roundTrip(sim, 50);
  });
});
