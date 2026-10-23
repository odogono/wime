import { describe, expect, test } from 'bun:test';

import { finishFight, type CombatRow, type CombatSide } from './combat';
import {
  BARAD_DUR,
  MOUNT_DOOM,
  passRingAfterFight,
  ringAtBaradDur,
  ringAtMountDoom
} from './ring';
import { restoreSave, serialiseSave } from './save';
import { createSim, tickSim, type SimState } from './state';

// The Ring's passing and endings, on a synthetic roster
// (docs/spec/winning-and-losing.md). Entries 7 to 10 are the Hobbits,
// figure 0; 78 is Gollum; 79 to 87 the Nazgûl; 100 an Evil Unit.

const HERE = { x: 640, y: 368 };
const DOL_GULDUR = { x: 1456, y: 672 };
const MORANNON = { x: 1744, y: 1008 };
const MINAS_MORGUL = { x: 1664, y: 1168 };

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 2,
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

const world = (
  entries: Record<string, unknown>[] = [],
  ringBearer = 7
): SimState => {
  const roster = Array.from({ length: 101 }, (_, index) =>
    entry({ index, state: 0 })
  );
  const hobbits = ['FRODO', 'SAM', 'MERRY', 'PIPPIN'];
  hobbits.forEach((name, i) => {
    roster[7 + i] = entry({ figure: 0, index: 7 + i, name, position: HERE });
  });
  roster[1] = entry({ index: 1, name: 'ARAGORN', position: HERE });
  roster[2] = entry({
    index: 2,
    is_unit: true,
    name: 'Rangers',
    position: HERE,
    starting_strength: 20,
    strength: 20
  });
  roster[78] = entry({ index: 78, name: 'GOLLUM', position: HERE });
  for (let i = 79; i <= 87; i++) {
    roster[i] = entry({
      allegiance: 0,
      index: i,
      name: `NAZGUL ${i}`,
      position: { x: 1000, y: 1000 },
      route: i - 78,
      state: 0
    });
  }
  roster[100] = entry({
    allegiance: 0,
    index: 100,
    is_unit: true,
    leader: 99,
    name: 'Orcs',
    position: HERE,
    route: 1,
    starting_strength: 50,
    strength: 50
  });
  for (const over of entries) {
    roster[over.index as number] = entry({
      ...roster[over.index as number],
      ...over
    });
  }
  return createSim(1, {
    clock: { day: 0, quarter_hour: 64 },
    events: { ring_bearer: ringBearer },
    object_placements: [{ object: 0, position: HERE }],
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
    roster,
    routes: Array.from({ length: 12 }, () => ({ places: [5] }))
  });
};

const row = (entries: number[], side: CombatSide, strength = 1): CombatRow => ({
  entries,
  follower: false,
  option: 'engage',
  side,
  startStrength: strength,
  strength
});

const after = (
  sim: SimState,
  rows: CombatRow[],
  winner: CombatSide,
  evil = 100
): SimState => ({
  ...sim,
  fight: {
    events: [],
    evil,
    good: rows.find(r => r.side === 'good')?.entries[0] ?? 7,
    position: { ...HERE },
    round: 3,
    rows,
    winner
  }
});

describe('the Ring passes after a fight', () => {
  test('Good wins: the first living Hobbit in the Good rows takes it', () => {
    const sim = world([{ index: 7, state: 0, strength: 0 }]);
    const next = passRingAfterFight(
      after(
        sim,
        [row([1], 'good'), row([7], 'good', 0), row([9], 'good')],
        'good'
      )
    );
    expect(next.ringBearer).toBe(9);
    expect(next.roster[9]!.objects).toEqual([0]);
    expect(next.objectPlacements[0]).toBeNull();
    expect(next.passings).toEqual([{ bearer: 9, kind: 'ring' }]);
  });

  test('Good wins with no Hobbit: the last-listed awake row, Unit or not', () => {
    // finding:objects-encounter-revives-third-nazgul, code+0x1327a.
    const sim = world([{ index: 7, state: 0, strength: 0 }]);
    const next = passRingAfterFight(
      after(sim, [row([1], 'good'), row([2], 'good', 20)], 'good')
    );
    expect(next.ringBearer).toBe(2);
  });

  test('Gollum takes it only when he is all that is left of Good', () => {
    const sim = world([{ index: 7, state: 0, strength: 0 }]);
    const withAragorn = passRingAfterFight(
      after(sim, [row([1], 'good'), row([78], 'good')], 'good')
    );
    expect(withAragorn.ringBearer).toBe(1);
    const alone = passRingAfterFight(
      after(sim, [row([1], 'good', 0), row([78], 'good')], 'good')
    );
    expect(alone.ringBearer).toBe(78);
  });

  test('Evil wins: the last Evil row takes it, leaves its Force for Barad-dûr, and the awake Nazgûl scatter', () => {
    const sim = world([
      { index: 7, state: 0, strength: 0 },
      { index: 80, state: 1 },
      { index: 81, state: 1 },
      { index: 82, state: 1 },
      { index: 83, state: 1 }
    ]);
    const next = passRingAfterFight(
      after(sim, [row([7], 'good', 0), row([100], 'evil', 50)], 'evil')
    );
    expect(next.ringBearer).toBe(100);
    const bearer = next.roster[100]!;
    expect(bearer.objects).toEqual([0]);
    expect(bearer.destination).toEqual(BARAD_DUR);
    expect(bearer.leader).toBeNull();
    expect(next.routes[1]).toEqual([]);
    for (const i of [80, 81, 82, 83]) {
      expect([DOL_GULDUR, MORANNON, MINAS_MORGUL]).toContainEqual(
        next.roster[i]!.destination!
      );
      expect(next.routes[i - 78]).toEqual([]);
    }
    // Asleep Nazgûl stay where they are.
    expect(next.roster[84]!.destination).toBeNull();
    expect(next.routes[6]).toEqual([5]);
  });

  test.each([
    { health: 3, state: 0, strength: 1 },
    { health: 0, state: 0, strength: 0 },
    { health: 3, state: 1, strength: 1 }
  ])('an Encounter sends the 3rd Nazgûl to take the Ring from %j', over => {
    const sim = world([
      { index: 7, state: 0, strength: 0 },
      { index: 81, leader: 80, ...over }
    ]);
    const next = passRingAfterFight(
      after(sim, [row([7], 'good', 0)], 'evil', 160)
    );
    expect(next.ringBearer).toBe(81);
    expect(next.roster[81]!.position).toEqual(HERE);
    expect(next.roster[81]!.state).toBe(1);
    expect(next.roster[81]!.strength).toBe(1);
    expect(next.roster[81]!.health).toBe(next.roster[81]!.maxHealth);
    expect(next.roster[81]!.objects).toEqual([0]);
    expect(next.roster[81]!.destination).toEqual(BARAD_DUR);
    expect(next.roster[81]!.leader).toBeNull();
    expect(next.routes[3]).toEqual([]);
    expect(next.objectPlacements[0]).toBeNull();
    expect(next.passings).toEqual([
      { kind: 'nazgul-sent' },
      { bearer: 81, kind: 'ring' }
    ]);
    expect(sim.roster[81]).toMatchObject({
      ...over,
      objects: [],
      position: { x: 1000, y: 1000 }
    });
    expect(sim.routes[3]).toEqual([5]);
  });

  test.each([
    { objectPlacements: [] },
    { objectPlacements: [{ object: 0, position: MOUNT_DOOM }] }
  ])(
    'an Encounter does not revive the 3rd Nazgûl without the Ring at the fight: %j',
    ({ objectPlacements }) => {
      const sim = after(
        {
          ...world([{ health: 0, index: 81, strength: 0 }]),
          objectPlacements: [...objectPlacements]
        },
        [row([7], 'good', 0)],
        'evil',
        160
      );
      expect(passRingAfterFight(sim)).toBe(sim);
      expect(sim.passings).toEqual([]);
    }
  );

  test('a Ring lying elsewhere stays where it is', () => {
    const sim = world();
    const next = passRingAfterFight(
      after(
        { ...sim, objectPlacements: [{ object: 0, position: MOUNT_DOOM }] },
        [row([1], 'good')],
        'good'
      )
    );
    expect(next.ringBearer).toBe(7);
    expect(next.objectPlacements[0]).toEqual({
      object: 0,
      position: MOUNT_DOOM
    });
  });

  test('finishFight drops the dead bearer’s Ring and hands it on', () => {
    const sim = world([], 7);
    const fought = finishFight({
      ...after(
        sim,
        [{ ...row([7], 'good', 0), startStrength: 1 }, row([8], 'good')],
        'good'
      ),
      objectPlacements: sim.objectPlacements.map(() => null),
      roster: sim.roster.map(e => (e.index === 7 ? { ...e, objects: [0] } : e))
    });
    expect(fought.roster[7]!.state).toBe(0);
    expect(fought.ringBearer).toBe(8);
    expect(fought.roster[8]!.objects).toEqual([0]);
    expect(fought.objectPlacements.every(slot => slot === null)).toBe(true);
  });

  test('finishFight revives the 3rd Nazgûl when an Encounter kills the Ring-bearer', () => {
    const sim = world([{ health: 0, index: 81, strength: 0 }]);
    const fought = finishFight({
      ...after(
        sim,
        [{ ...row([7], 'good', 0), startStrength: 1 }],
        'evil',
        160
      ),
      objectPlacements: sim.objectPlacements.map(() => null),
      roster: sim.roster.map(e => (e.index === 7 ? { ...e, objects: [0] } : e))
    });
    expect(fought.roster[7]!.state).toBe(0);
    expect(fought.roster[7]!.objects).toEqual([0]);
    expect(fought.ringBearer).toBe(81);
    expect(fought.roster[81]).toMatchObject({
      destination: BARAD_DUR,
      health: fought.roster[81]!.maxHealth,
      objects: [0],
      position: HERE,
      state: 1,
      strength: 1
    });
    expect(fought.passings).toEqual([
      { kind: 'nazgul-sent' },
      { bearer: 81, kind: 'ring' }
    ]);
    expect(fought.objectPlacements.every(slot => slot === null)).toBe(true);
  });
});

describe('the Ring at Mount Doom', () => {
  test('the bearer’s top Leader on Mount Doom wins', () => {
    const sim = world([
      { index: 1, position: MOUNT_DOOM },
      { index: 7, leader: 1 }
    ]);
    expect(ringAtMountDoom(sim.roster, 7)).toBe('won-mount-doom');
    expect(ringAtMountDoom(world().roster, 7)).toBeNull();
  });

  test('is tested at the whole hour on the Campaign Level', () => {
    // At quarter-hour 63 the next tick reaches the hour.
    const sim = {
      ...world([{ index: 7, position: MOUNT_DOOM, state: 3 }]),
      clock: { day: 0, quarterHour: 63 }
    };
    expect(tickSim(sim).ending).toBe('won-mount-doom');
    expect(tickSim({ ...sim, watching: 7 }).ending).toBeNull();
    expect(
      tickSim({ ...sim, clock: { day: 0, quarterHour: 64 } }).ending
    ).toBeNull();
  });
});

describe('the Ring at Barad-dûr', () => {
  test('an Evil Leader carrying the Ring onto Barad-dûr loses', () => {
    const sim = world([
      { allegiance: 0, index: 81, objects: [0], position: BARAD_DUR }
    ]);
    expect(ringAtBaradDur(sim.roster[81]!)).toBe('lost-barad-dur');
    expect(ringAtBaradDur({ ...sim.roster[81]!, allegiance: 99 })).toBeNull();
    expect(ringAtBaradDur({ ...sim.roster[81]!, objects: [] })).toBeNull();
  });

  test('ends the game in the step that arrives', () => {
    const sim = world([
      {
        allegiance: 0,
        destination: BARAD_DUR,
        index: 81,
        objects: [0],
        position: { x: BARAD_DUR.x - 16, y: BARAD_DUR.y },
        state: 1
      }
    ]);
    let next = sim;
    for (let i = 0; i < 200 && !next.ending; i++) {
      next = tickSim(next);
    }
    expect(next.ending).toBe('lost-barad-dur');
    expect(next.roster[81]!.position).toEqual(BARAD_DUR);
    expect(tickSim(next)).toBe(next);
  });
});

describe('saving', () => {
  test('a passed Ring-bearer survives save and restore', () => {
    const sim = world([{ index: 7, state: 0, strength: 0 }]);
    const next = passRingAfterFight(after(sim, [row([9], 'good')], 'good'));
    const restored = restoreSave(serialiseSave({ ...next, fight: null }), null);
    expect(restored.ok && restored.state.ringBearer).toBe(9);
    expect(restored.ok && restored.state.roster[9]!.objects).toEqual([0]);
  });
});
