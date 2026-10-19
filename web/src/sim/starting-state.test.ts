import { describe, expect, test } from 'bun:test';

import {
  forcesOf,
  forcesOnMap,
  loadStartingState,
  placeAt,
  placeKindForTile,
  topLeader
} from './starting-state';
import { createSim, deserializeSim, serializeSim } from './state';

// A miniature starting state in the shape tools/extract-starting-state.ts
// writes: a Leader at Hobbiton with a Character and a Unit following, an
// asleep Leader, an awake Evil Unit and an Encounter figure.
const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 4,
  fighting: 4,
  figure: 0,
  health: 7,
  icon: 2,
  index: 0,
  is_unit: false,
  leader: null,
  max_health: 7,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 1,
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

const startingStateJson = {
  clock: { date: '23 September 1418 S.R.', day: 0, quarter_hour: 64 },
  events: { event_days: [0], mask: 5, ring_bearer: 1 },
  place_kinds: [{ index: 70, name: 'a small town', tile: 46 }],
  places: [
    {
      announces_attacks: false,
      grid_byte: 50,
      grid_reference: 'B3',
      index: 2,
      name: 'HOBBITON',
      position: { x: 640, y: 368 },
      tile: { x: 40, y: 23 },
      tile_kind: null
    }
  ],
  roster: [
    entry({ index: 0, ticked: false }),
    entry({
      index: 1,
      name: 'FRODO',
      objects: [0, 4],
      position: { x: 640, y: 368 }
    }),
    entry({ index: 2, leader: 1, name: 'SAM' }),
    entry({
      icon: 0x20,
      index: 3,
      is_unit: true,
      leader: 1,
      name: 'cavalry',
      starting_strength: 120,
      strength: 120
    }),
    entry({
      index: 4,
      name: 'GANDALF',
      position: { x: 1216, y: 380 },
      state: 0
    }),
    entry({
      allegiance: 0,
      icon: 0x44,
      index: 5,
      is_unit: true,
      name: 'orcs',
      position: { x: 1280, y: 144 },
      starting_strength: 500,
      strength: 500
    }),
    entry({
      encounter: {
        area: { bottom: 10, left: 0, right: 20, top: 0 },
        chance: 50,
        earliest_day: 3
      },
      index: 6,
      name: 'TOM BOMBADIL',
      ticked: false,
      unknown: { b19: 0, b24: 0, b29: null }
    })
  ]
};

describe('loadStartingState', () => {
  test('converts the exported JSON to sim state', () => {
    const sim = createSim(1, startingStateJson);
    expect(sim.clock).toEqual({ day: 0, quarterHour: 64 });
    expect(sim.ringBearer).toBe(1);
    expect(sim.roster[1]?.name).toBe('FRODO');
    expect(sim.roster[1]?.isUnit).toBe(false);
    expect(sim.roster[3]?.isUnit).toBe(true);
    expect(sim.roster[3]?.startingStrength).toBe(120);
    expect(sim.roster[6]?.encounter?.earliestDay).toBe(3);
    expect(sim.places[0]?.name).toBe('HOBBITON');
    expect(sim.placeKinds[0]?.name).toBe('a small town');
  });

  test('rejects anything that is not a starting state', () => {
    expect(() => loadStartingState(null)).toThrow();
    expect(() => loadStartingState({ roster: [] })).toThrow();
    expect(() => createSim(1, { places: [{}], roster: [{}] })).toThrow();
    const broken = structuredClone(startingStateJson);
    (broken.roster[1] as Record<string, unknown>).position = 'Hobbiton';
    expect(() => loadStartingState(broken)).toThrow();
  });

  test('serialises and restores exactly, roster and Places included', () => {
    const sim = createSim(7, startingStateJson);
    expect(deserializeSim(serializeSim(sim))).toEqual(sim);
  });
});

describe('forces', () => {
  const { roster } = loadStartingState(startingStateJson);

  test('a Force is its Leader and everyone whose chain ends there', () => {
    // finding:forces-leader-byte-forms-forces
    expect(topLeader(roster, roster[3]!)?.index).toBe(1);
    const forces = forcesOf(roster);
    expect(forces.map(force => force.leader.index)).toEqual([1, 4, 5]);
    // Leader first, then followers in roster order; at the Leader's
    // position. The Encounter figure (6) forms no Force.
    expect(forces[0]?.members.map(member => member.index)).toEqual([1, 2, 3]);
    expect(forces[0]?.position).toEqual({ x: 640, y: 368 });
  });

  test('only Forces with an awake Leader are on the map', () => {
    // finding:forces-starting-forces-on-the-map: entry 4 is asleep.
    expect(forcesOnMap(roster).map(force => force.leader.index)).toEqual([
      1, 5
    ]);
  });

  test('active Forces are the ones whose Leader allegiance is above 2', () => {
    // finding:mobilisation-allegiance-byte (code+0x0d28a blinks them).
    const byLeader = new Map(
      forcesOf(roster).map(force => [force.leader.index, force.active])
    );
    expect(byLeader.get(1)).toBe(true);
    expect(byLeader.get(5)).toBe(false);
  });
});

describe('places', () => {
  const { placeKinds, places } = loadStartingState(startingStateJson);

  test('a point is at a named Place only on its exact tile', () => {
    // finding:places-named-places-matched-by-position. Hobbiton's tile
    // is (40, 23), covering pixels 640-655 by 368-383.
    expect(placeAt(places, { x: 640, y: 368 })?.name).toBe('HOBBITON');
    expect(placeAt(places, { x: 655, y: 383 })?.name).toBe('HOBBITON');
    expect(placeAt(places, { x: 656, y: 368 })).toBeNull();
    expect(placeAt(places, { x: 640, y: 384 })).toBeNull();
  });

  test('generic kinds are matched by map tile number', () => {
    // finding:places-kinds-matched-by-map-tile
    expect(placeKindForTile(placeKinds, 46)).toBe('a small town');
    expect(placeKindForTile(placeKinds, 47)).toBeNull();
  });
});
