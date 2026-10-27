import { describe, expect, test } from 'bun:test';

import { nextRandom } from './rng';
import { restoreSave, serialiseSave } from './save';
import { createSim, tickSim, type SimState } from './state';
import { applyObject, usableList } from './use';
import { hasWarEvent } from './war-events';

// Using objects, on a synthetic roster (docs/spec/objects.md, "Use").
// Object numbers are bits: 1 a Dwarven Ring, 4 an Elven blade, 7 a
// Palantir, 9 a blue potion, 10 a black flask, 11 a glowing vial,
// 12 the Red Arrow, 13 a coil of rope, 14 a sceptre, 15 a silver orb
// (finding:objects-carried-as-a-bitmask).

const HOBBITON = { x: 640, y: 368 };
const EREBOR = { x: 1744, y: 224 };
const EDORAS = { x: 1136, y: 864 };
const MINAS_TIRITH = { x: 1568, y: 1008 };
const WOODLAND_REALM = { x: 1600, y: 288 };

const FRODO = 7;
const DAIN = 17;
const DAINS_DWARVES = 18;
const THRANDUIL = 22;
const THEODEN = 26;
const DENETHOR = 32;
const ELVES = 62;

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 4,
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
  state: 0,
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

// Frodo carrying every usable object, and the four rulers awake at
// home with their followers waiting, as at the start.
const world = (
  over: { frodo?: Record<string, unknown>; seed?: number } = {}
): SimState => {
  const roster = Array.from({ length: 63 }, (_, index) => entry({ index }));
  roster[FRODO] = entry({
    index: FRODO,
    name: 'FRODO',
    objects: [0, 1, 4, 7, 9, 10, 11, 12, 13, 14, 15],
    position: HOBBITON,
    state: 1,
    ...over.frodo
  });
  const ruler = (index: number, position: typeof HOBBITON, trigger: number) =>
    entry({
      allegiance: 1,
      index,
      position,
      state: 1,
      trigger_byte: trigger
    });
  roster[DAIN] = ruler(DAIN, EREBOR, 0x40);
  roster[DAINS_DWARVES] = entry({
    allegiance: 1,
    index: DAINS_DWARVES,
    position: EREBOR
  });
  roster[THRANDUIL] = ruler(THRANDUIL, WOODLAND_REALM, 0x40);
  roster[THEODEN] = ruler(THEODEN, EDORAS, 0x10);
  roster[DENETHOR] = ruler(DENETHOR, MINAS_TIRITH, 0x08);
  roster[ELVES] = entry({
    allegiance: 1,
    index: ELVES,
    position: WOODLAND_REALM,
    trigger_byte: 0x40
  });
  return createSim(over.seed ?? 1, {
    clock: { day: 0, quarter_hour: 31 },
    events: { ring_bearer: FRODO },
    object_placements: [],
    place_kinds: [],
    places: [
      {
        announces_attacks: false,
        grid_byte: 0,
        grid_reference: null,
        index: 1,
        name: 'HOBBITON',
        position: HOBBITON,
        tile: { x: 40, y: 23 },
        tile_kind: null
      }
    ],
    roster
  });
};

const roll100 = (seed: number): number =>
  Math.floor(nextRandom(seed).value * 100);

// Seeds whose first draw is above 30, and at most 30.
const VISION_SEED = Array.from({ length: 100 }, (_, i) => i).find(
  seed => roll100(seed) > 30
)!;
const TIP_SEED = Array.from({ length: 100 }, (_, i) => i).find(
  seed => roll100(seed) <= 30
)!;

const carries = (state: SimState, object: number): boolean =>
  state.roster[FRODO]!.objects.includes(object);

describe('the Use list', () => {
  test('lists the usable objects carried, in order, never the Ring', () => {
    // finding:objects-provisions-lists, finding:objects-use-table
    expect(usableList(world(), FRODO)).toEqual([
      1, 7, 9, 10, 11, 12, 13, 14, 15
    ]);
    expect(usableList(world(), 8)).toEqual([]);
  });

  test('an object not carried or not usable does nothing', () => {
    const sim = world();
    expect(applyObject(sim, FRODO, 4, HOBBITON)).toEqual({
      outcome: null,
      state: sim
    });
    expect(applyObject(sim, FRODO, 0, HOBBITON).outcome).toBeNull();
    expect(applyObject(sim, 8, 9, HOBBITON).outcome).toBeNull();
  });
});

describe('the draughts and the rope', () => {
  test('a blue potion heals to full and is used up', () => {
    // finding:objects-draughts-heal-and-strengthen
    const { outcome, state } = applyObject(
      world({ frodo: { health: 3 } }),
      FRODO,
      9,
      HOBBITON
    );
    expect(outcome).toEqual({ healed: true, use: 'blue-potion' });
    expect(state.roster[FRODO]!.health).toBe(7);
    expect(carries(state, 9)).toBe(false);
  });

  test('a blue potion at full health has no effect but is still used up', () => {
    const { outcome, state } = applyObject(world(), FRODO, 9, HOBBITON);
    expect(outcome).toEqual({ healed: false, use: 'blue-potion' });
    expect(carries(state, 9)).toBe(false);
  });

  test('a black flask adds one to fighting strength, uncapped', () => {
    const { outcome, state } = applyObject(world(), FRODO, 10, HOBBITON);
    expect(outcome).toEqual({ use: 'black-flask' });
    expect(state.roster[FRODO]!.fighting).toBe(5);
    expect(carries(state, 10)).toBe(false);
  });

  test('a glowing vial raises maximum health and heals to it', () => {
    const { outcome, state } = applyObject(
      world({ frodo: { health: 2 } }),
      FRODO,
      11,
      HOBBITON
    );
    expect(outcome).toEqual({ use: 'glowing-vial' });
    expect(state.roster[FRODO]!.maxHealth).toBe(8);
    expect(state.roster[FRODO]!.health).toBe(8);
    expect(carries(state, 11)).toBe(false);
  });

  test('the rope does nothing and is kept', () => {
    // finding:objects-rope-has-no-use
    const sim = world();
    const { outcome, state } = applyObject(sim, FRODO, 13, HOBBITON);
    expect(outcome).toEqual({ use: 'rope' });
    expect(state).toEqual(sim);
  });
});

describe('Tokens', () => {
  // finding:mobilisation-token-shown-to-ruler
  const cases = [
    { hint: 39, object: 1, position: EREBOR, ruler: DAIN, text: 38 },
    { hint: 41, object: 12, position: EDORAS, ruler: THEODEN, text: 40 },
    { hint: 43, object: 14, position: MINAS_TIRITH, ruler: DENETHOR, text: 42 },
    {
      hint: 45,
      object: 15,
      position: WOODLAND_REALM,
      ruler: THRANDUIL,
      text: 44
    }
  ];

  for (const { hint, object, position, ruler, text } of cases) {
    test(`token ${object} shown away from its ruler gives the hint and is kept`, () => {
      const sim = world();
      const { outcome, state } = applyObject(sim, FRODO, object, HOBBITON);
      expect(outcome).toEqual({ text: hint, use: 'token', worked: false });
      expect(state).toEqual(sim);
    });

    test(`token ${object} on its awake ruler mobilises him`, () => {
      const sim = world({ frodo: { position } });
      const { outcome, state } = applyObject(sim, FRODO, object, position);
      expect(outcome).toEqual({ text, use: 'token', worked: true });
      expect(state.roster[ruler]!.allegiance).toBe(99);
      expect(state.roster[ruler]!.triggerByte).toBe(0);
      // Only the sceptre is kept (finding:objects-use-table).
      expect(carries(state, object)).toBe(object === 14);
    });
  }

  test('a Token on its ruler asleep gives the hint', () => {
    const sim = world({ frodo: { position: EREBOR } });
    sim.roster[DAIN] = { ...sim.roster[DAIN]!, state: 0 };
    const { outcome, state } = applyObject(sim, FRODO, 1, EREBOR);
    expect(outcome).toEqual({ text: 39, use: 'token', worked: false });
    expect(state.roster[DAIN]!.allegiance).toBe(1);
    expect(carries(state, 1)).toBe(true);
  });

  test('the position, not the user, must be on the ruler', () => {
    const { outcome } = applyObject(world(), FRODO, 1, EREBOR);
    expect(outcome).toEqual({ text: 38, use: 'token', worked: true });
  });

  test("Dáin's dwarves stay unmobilised", () => {
    const sim = world({ frodo: { position: EREBOR } });
    const { state } = applyObject(sim, FRODO, 1, EREBOR);
    expect(state.roster[DAINS_DWARVES]!.allegiance).toBe(1);
  });

  test('the silver orb also wakes and mobilises the elves of entry 62', () => {
    const sim = world({ frodo: { position: WOODLAND_REALM } });
    const { state } = applyObject(sim, FRODO, 15, WOODLAND_REALM);
    expect(state.roster[ELVES]).toMatchObject({
      allegiance: 99,
      state: 1,
      triggerByte: 0
    });
  });

  test('the sceptre shown to Denethor again only gives the hint', () => {
    const sim = world({ frodo: { position: MINAS_TIRITH } });
    const once = applyObject(sim, FRODO, 14, MINAS_TIRITH).state;
    const { outcome, state } = applyObject(once, FRODO, 14, MINAS_TIRITH);
    expect(outcome).toEqual({ text: 43, use: 'token', worked: false });
    expect(state).toEqual(once);
  });

  test('Théoden and Denethor mobilised bring events 5 and 3 at the next check', () => {
    // finding:ai-war-events
    let sim = world({ frodo: { position: EDORAS } });
    sim = applyObject(sim, FRODO, 12, EDORAS).state;
    sim.roster[FRODO] = { ...sim.roster[FRODO]!, position: MINAS_TIRITH };
    sim = applyObject(sim, FRODO, 14, MINAS_TIRITH).state;
    expect(hasWarEvent(sim.warEvents, 5)).toBe(false);
    sim = tickSim(sim);
    expect(sim.clock.quarterHour).toBe(32);
    expect(hasWarEvent(sim.warEvents, 5)).toBe(true);
    expect(hasWarEvent(sim.warEvents, 3)).toBe(true);
  });

  test('mobilised rulers survive a save', () => {
    const sim = world({ frodo: { position: EDORAS } });
    const { state } = applyObject(sim, FRODO, 12, EDORAS);
    expect(restoreSave(serialiseSave(state), null)).toEqual({
      ok: true,
      setup: null,
      state
    });
  });
});

describe('the Palantír', () => {
  // finding:objects-palantir-vision-or-tip
  test('above 30 in 100 shows the vision and sets War Event 7 with the day', () => {
    const sim = world({ seed: VISION_SEED });
    const { outcome, state } = applyObject(sim, FRODO, 7, HOBBITON);
    expect(outcome).toEqual({ use: 'palantir', vision: true });
    expect(state.warEvents.mask).toBe(0x85);
    expect(state.warEvents.days[7]).toBe(0);
    expect(state.announcements).toEqual([]);
    expect(carries(state, 7)).toBe(true);
  });

  test('at most 30 gives an advisor tip and changes nothing else', () => {
    const sim = world({ seed: TIP_SEED });
    const { outcome, state } = applyObject(sim, FRODO, 7, HOBBITON);
    expect(outcome).toEqual({ use: 'palantir', vision: false });
    expect({ ...state, rng: sim.rng }).toEqual(sim);
  });

  test('with War Event 7 already set it only gives tips', () => {
    const sim = world({ seed: VISION_SEED });
    const once = applyObject(sim, FRODO, 7, HOBBITON).state;
    const { outcome, state } = applyObject(
      { ...once, rng: VISION_SEED },
      FRODO,
      7,
      HOBBITON
    );
    expect(outcome).toEqual({ use: 'palantir', vision: false });
    expect(state.warEvents).toEqual(once.warEvents);
  });

  test('the early War Event brings 3, 4 and 6 and only Saruman’s march', () => {
    // finding:ai-war-events-set-once,
    // finding:mobilisation-tripwires-follow-arrival
    let sim = applyObject(
      world({ seed: VISION_SEED }),
      FRODO,
      7,
      HOBBITON
    ).state;
    sim = tickSim(sim);
    expect(sim.clock.quarterHour).toBe(32);
    for (const bit of [3, 4, 6]) {
      expect(hasWarEvent(sim.warEvents, bit)).toBe(true);
    }
    expect(sim.announcements).toEqual([{ day: 0, event: 4 }]);
  });
});
