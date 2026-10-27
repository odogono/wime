import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { finishFight } from './combat';
import {
  OBJECT_PLACEMENT_COUNT,
  putDownList,
  putDownObject,
  takeList,
  takeObject
} from './objects';
import { restoreSave, serialiseSave } from './save';
import { createSim, type SimState } from './state';

// Objects carried and placed, on a synthetic roster
// (docs/spec/objects.md). Object numbers are bits: 0 the Ring,
// 4 an Elven blade, 9 a blue potion, 12 the Red Arrow
// (finding:objects-carried-as-a-bitmask).

const HERE = { x: 640, y: 368 };
const ELSEWHERE = { x: 1216, y: 384 };

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  health: 7,
  icon: 0,
  index: 0,
  is_unit: false,
  leader: null,
  max_health: 7,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 2,
  stamina: 40,
  starting_strength: 1,
  state: 1,
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

// Frodo (7) at HERE carrying the Ring and an Elven blade, Sam (8)
// following him, and objects lying here and elsewhere.
const world = (
  over: { placements?: { object: number; position: typeof HERE }[] } = {}
): SimState => {
  const roster = Array.from({ length: 10 }, (_, index) =>
    entry({ index, state: 0, ticked: index > 0 })
  );
  roster[7] = entry({
    index: 7,
    name: 'FRODO',
    objects: [0, 4],
    position: HERE
  });
  roster[8] = entry({ index: 8, leader: 7, name: 'SAM' });
  roster[9] = entry({ index: 9, name: 'MERRY', position: ELSEWHERE });
  return createSim(1, {
    clock: { day: 0, quarter_hour: 64 },
    events: { ring_bearer: 7 },
    object_placements: over.placements ?? [
      { object: 9, position: HERE },
      { object: 9, position: HERE },
      { object: 12, position: ELSEWHERE }
    ],
    place_kinds: [],
    places: [
      {
        announces_attacks: false,
        grid_byte: 0,
        grid_reference: null,
        index: 1,
        name: 'HOBBITON',
        position: HERE,
        tile: { x: 40, y: 23 },
        tile_kind: null
      }
    ],
    roster
  });
};

describe('starting placements', () => {
  test('the table has 30 slots, the placed objects first, the rest free', () => {
    const sim = world();
    expect(sim.objectPlacements).toHaveLength(OBJECT_PLACEMENT_COUNT);
    expect(sim.objectPlacements.slice(0, 3)).toEqual([
      { object: 9, position: HERE },
      { object: 9, position: HERE },
      { object: 12, position: ELSEWHERE }
    ]);
    expect(sim.objectPlacements.slice(3)).toEqual(
      Array.from({ length: 27 }, () => null)
    );
  });

  // The exported starting state is gitignored and absent in CI.
  const startingStatePath = new URL(
    '../../public/assets/starting-state.json',
    import.meta.url
  );
  test.skipIf(!existsSync(startingStatePath))(
    'the Reference Build starts with 25 objects lying on the map',
    () => {
      // finding:objects-starting-placements
      const sim = createSim(
        1,
        JSON.parse(readFileSync(startingStatePath, 'utf8'))
      );
      const filled = sim.objectPlacements.filter(slot => slot !== null);
      expect(filled).toHaveLength(25);
      expect(sim.objectPlacements.slice(25)).toEqual(
        Array.from({ length: 5 }, () => null)
      );
    }
  );
});

describe('put down', () => {
  test('lists what the chosen Character carries, never the Ring', () => {
    // finding:objects-provisions-lists
    const sim = world();
    expect(putDownList(sim, 7)).toEqual([4]);
    expect(putDownList(sim, 8)).toEqual([]);
  });

  test('fills the first free slot at the position and stops carrying it', () => {
    // finding:objects-put-down-fills-a-free-slot
    const next = putDownObject(world(), 7, 4, HERE);
    expect(next.roster[7]?.objects).toEqual([0]);
    expect(next.objectPlacements[3]).toEqual({ object: 4, position: HERE });
  });

  test('the Ring cannot be put down, nor what is not carried', () => {
    const sim = world();
    expect(putDownObject(sim, 7, 0, HERE)).toBe(sim);
    expect(putDownObject(sim, 7, 9, HERE)).toBe(sim);
    expect(putDownObject(sim, 99, 4, HERE)).toBe(sim);
  });

  test('with no free slot the object is lost', () => {
    const full = world({
      placements: Array.from({ length: 30 }, () => ({
        object: 9,
        position: ELSEWHERE
      }))
    });
    const next = putDownObject(full, 7, 4, HERE);
    expect(next.roster[7]?.objects).toEqual([0]);
    expect(next.objectPlacements).toEqual(full.objectPlacements);
  });
});

describe('take', () => {
  test('lists at most seven objects lying exactly at the position', () => {
    // finding:objects-provisions-lists
    const many = world({
      placements: Array.from({ length: 9 }, (_, i) => ({
        object: i + 1,
        position: HERE
      }))
    });
    expect(takeList(many, HERE)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(takeList(world(), HERE)).toEqual([9, 9]);
    expect(takeList(world(), { x: 641, y: 368 })).toEqual([]);
  });

  test('frees the first slot holding it here and carries it', () => {
    // finding:objects-take-from-the-ground
    const next = takeObject(world(), 8, 9, HERE);
    expect(next.roster[8]?.objects).toEqual([9]);
    expect(next.objectPlacements[0]).toBeNull();
    expect(next.objectPlacements[1]).toEqual({ object: 9, position: HERE });
  });

  test('taking what is already carried loses the one on the ground', () => {
    const carried = takeObject(world(), 8, 9, HERE);
    const next = takeObject(carried, 8, 9, HERE);
    expect(next.roster[8]?.objects).toEqual([9]);
    expect(next.objectPlacements[1]).toBeNull();
  });

  test('taking the Ring makes the taker the Ring-bearer', () => {
    const sim = world({ placements: [{ object: 0, position: HERE }] });
    const next = takeObject(sim, 8, 0, HERE);
    expect(next.roster[8]?.objects).toEqual([0]);
    expect(next.ringBearer).toBe(8);
  });

  test('nothing happens when the object is not lying here', () => {
    const sim = world();
    expect(takeObject(sim, 8, 12, HERE)).toBe(sim);
    expect(takeObject(sim, 99, 9, HERE)).toBe(sim);
  });
});

describe('dropping on death', () => {
  test('a Character killed in a fight leaves its objects at the fight', () => {
    // finding:objects-dead-drop-their-objects: the Ring included, and
    // the dead entry's own objects are not cleared.
    const sim = world({ placements: [] });
    const dead: SimState = {
      ...sim,
      fight: {
        events: [],
        evil: 9,
        good: 7,
        position: { ...HERE },
        round: 1,
        rows: [
          {
            entries: [7],
            follower: false,
            option: 'gone',
            side: 'good',
            startStrength: 1,
            strength: 0
          }
        ],
        winner: 'evil'
      },
      // Merry stands elsewhere, so only Frodo's losses are taken.
      roster: sim.roster.map(e =>
        e.index === 9 ? { ...e, position: { ...ELSEWHERE } } : e
      )
    };
    const next = finishFight(dead);
    expect(next.roster[7]?.state).toBe(0);
    expect(next.roster[7]?.objects).toEqual([0, 4]);
    // The Ring is then taken from the ground even with no winner left
    // to carry it (finding:objects-encounter-revives-third-nazgul).
    expect(next.objectPlacements.slice(0, 2)).toEqual([
      null,
      { object: 4, position: HERE }
    ]);
  });
});

describe('saving', () => {
  test('save and restore keep objects carried and placed', () => {
    const moved = takeObject(putDownObject(world(), 7, 4, HERE), 8, 9, HERE);
    expect(restoreSave(serialiseSave(moved), null)).toEqual({
      ok: true,
      setup: null,
      state: moved
    });
  });
});
