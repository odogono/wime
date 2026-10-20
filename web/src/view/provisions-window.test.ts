import { describe, expect, test } from 'bun:test';

import {
  createSim,
  hasWarEvent,
  nextRandom,
  type SimState
} from '../sim/index';
import { textKey } from './assets';
import {
  CHOICE_MS,
  MESSAGE_MS,
  chooseCharacter,
  chooseObject,
  holdsClock,
  openObjectList,
  openProvisions,
  provisionsButtonAt
} from './provisions-window';
import { FIXED_FONT } from './test-font';

// The provisions windows on a synthetic roster (docs/spec/objects.md):
// Frodo (1) carries the Ring and an Elven blade, Sam (2) is asleep, a
// Unit (3) of 40, and a blue potion lies here.

const HERE = { x: 640, y: 368 };

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  health: 3,
  icon: 0,
  index: 0,
  is_unit: false,
  leader: null,
  max_health: 7,
  max_stamina: 40,
  name: '',
  objects: [],
  position: HERE,
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

const world = (): SimState =>
  createSim(1, {
    clock: { day: 0, quarter_hour: 64 },
    events: { ring_bearer: 1 },
    object_placements: [{ object: 9, position: HERE }],
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
    roster: [
      entry({ index: 0, state: 0 }),
      entry({ index: 1, name: 'FRODO', objects: [0, 4] }),
      entry({ index: 2, leader: 1, name: 'SAM', state: 0 }),
      entry({
        index: 3,
        is_unit: true,
        name: 'Riders',
        starting_strength: 40,
        strength: 40
      })
    ]
  });

const texts = new Map([
  [textKey('BScene.res', 36), 'There is no need to use the rope here.']
]);

describe('choosing the Character', () => {
  // finding:ui-provisions-chosen-character
  test('keeps the last chosen if awake, else the first awake member', () => {
    const sim = world();
    expect(chooseCharacter(sim, [2, 1], null)).toBe(1);
    expect(chooseCharacter(sim, [1, 2], 2)).toBe(1);
  });

  test('a Unit or a sleeping party asks for an active member', () => {
    const sim = world();
    expect(chooseCharacter(sim, [3], null)).toBeNull();
    const window = openProvisions(FIXED_FONT, sim, [2], null, 0);
    expect(window.kind === 'message' && window.lines).toEqual([
      'Please select an active member',
      'of the party.'
    ]);
  });
});

describe('the menu', () => {
  // finding:ui-provisions-window
  test('opens at (168, 5) with the three choices and holds the clock', () => {
    const window = openProvisions(FIXED_FONT, world(), [1], null, 0);
    expect(window.box).toEqual({ height: 68, width: 112, x: 168, y: 5 });
    expect(window.kind === 'menu' && window.heading).toBe(
      'Would FRODO like to...'
    );
    expect(
      window.kind === 'menu' && window.buttons.map(b => [b.label, b.y])
    ).toEqual([
      ['Put down an object', 26],
      ['Take an object', 41],
      ['Use an object', 56]
    ]);
    expect(window.until).toBe(CHOICE_MS);
    expect(holdsClock(window)).toBe(true);
    const take = provisionsButtonAt(window, { x: 190, y: 42 });
    expect(take?.value).toBe('take');
  });
});

describe('the lists', () => {
  // finding:ui-object-list-window, finding:ui-object-list-empty-messages
  test('Put Down lists the carried objects but the Ring', () => {
    const window = openObjectList(FIXED_FONT, world(), 1, 'put-down', HERE, 0);
    expect(window.box).toEqual({ height: 38, width: 176, x: 112, y: 5 });
    expect(window.kind === 'put-down' && window.heading).toBe(
      'Select the object for FRODO to drop:'
    );
    expect(
      window.kind === 'put-down' && window.buttons.map(b => b.label)
    ).toEqual(['an Elven blade']);
  });

  test('the empty lists show the original messages', () => {
    const sim = world();
    const lines = (window: ReturnType<typeof openObjectList>) =>
      window.kind === 'message' ? window.lines : null;
    expect(lines(openObjectList(FIXED_FONT, sim, 1, 'use', HERE, 0))).toEqual([
      "FRODO has nothing which is 'usable'."
    ]);
    expect(
      lines(openObjectList(FIXED_FONT, sim, 1, 'take', { x: 0, y: 8 }, 0))
    ).toEqual(['There are no objects here.']);
    const empty = openObjectList(FIXED_FONT, sim, 2, 'put-down', HERE, 0);
    expect(lines(empty)).toEqual(['SAM is unwilling to part with anything.']);
    expect(empty.until).toBe(MESSAGE_MS);
    expect(holdsClock(empty)).toBe(false);
  });
});

describe('choosing an object', () => {
  test('Take picks it up with the original message', () => {
    // finding:objects-take-message
    const sim = world();
    const list = openObjectList(FIXED_FONT, sim, 1, 'take', HERE, 0);
    if (list.kind !== 'take') {
      throw new Error('expected a list');
    }
    const result = chooseObject(
      FIXED_FONT,
      sim,
      1,
      list.kind,
      9,
      HERE,
      texts,
      new Set(),
      () => 0,
      0
    );
    expect(result.sim.roster[1]!.objects).toEqual([0, 4, 9]);
    expect(result.window?.kind === 'message' && result.window.lines).toEqual([
      'FRODO goes to pick up a blue potion.'
    ]);
  });

  test('Use words what the draught did', () => {
    // finding:objects-use-message-boxes
    const taken = world();
    const take = openObjectList(FIXED_FONT, taken, 1, 'take', HERE, 0);
    if (take.kind !== 'take') {
      throw new Error('expected a list');
    }
    const sim = chooseObject(
      FIXED_FONT,
      taken,
      1,
      take.kind,
      9,
      HERE,
      texts,
      new Set(),
      () => 0,
      0
    ).sim;
    const list = openObjectList(FIXED_FONT, sim, 1, 'use', HERE, 0);
    if (list.kind !== 'use') {
      throw new Error('expected a list');
    }
    const result = chooseObject(
      FIXED_FONT,
      sim,
      1,
      list.kind,
      9,
      HERE,
      texts,
      new Set(),
      () => 0,
      0
    );
    expect(result.sim.roster[1]).toMatchObject({ health: 7, objects: [0, 4] });
    expect(result.window?.box.width).toBe(128);
    expect(result.window?.kind === 'message' && result.window.lines).toEqual([
      'FRODO feels much better.'
    ]);
  });
});

const carrying = (object: number): SimState => {
  const sim = world();
  return {
    ...sim,
    roster: sim.roster.map(candidate =>
      candidate.index === 1 ? { ...candidate, objects: [object] } : candidate
    )
  };
};
const use = (
  sim: SimState,
  object: number,
  resources: Map<string, string>,
  given = new Set<number>()
) =>
  chooseObject(
    FIXED_FONT,
    sim,
    1,
    'use',
    object,
    HERE,
    resources,
    given,
    () => 0,
    0
  );
const lines = (result: ReturnType<typeof use>) =>
  result.window?.kind === 'message' ? result.window.lines : null;

const seedFor = (vision: boolean): number =>
  Array.from({ length: 100 }, (_, i) => i).find(
    seed => Math.floor(nextRandom(seed).value * 100) > 30 === vision
  )!;

// The view must use the same object-use rules as the sim after #106.
describe('Use with Tokens and the Palantír', () => {
  test.each([
    { hintWidth: 192, object: 1, ruler: 17, successHeight: 24, text: 38 },
    { hintWidth: 192, object: 12, ruler: 26, successHeight: 49, text: 40 },
    { hintWidth: 208, object: 14, ruler: 32, successHeight: 56, text: 42 },
    { hintWidth: 224, object: 15, ruler: 22, successHeight: 48, text: 44 }
  ])(
    'Token $object uses the displayed position and shows success or a hint',
    ({ hintWidth, object, ruler, successHeight, text }) => {
      // finding:mobilisation-token-shown-to-ruler,
      // finding:objects-use-message-boxes
      const sim = carrying(object);
      sim.roster = Array.from(
        { length: 63 },
        (_, index) => sim.roster[index] ?? { ...sim.roster[0]!, index }
      );
      sim.roster[ruler] = {
        ...sim.roster[ruler]!,
        allegiance: 1,
        position: HERE,
        state: 1,
        triggerByte: 64
      };
      // The chosen Character need not have its own position at the ruler.
      sim.roster[1] = { ...sim.roster[1]!, position: null };
      const resources = new Map([
        [textKey('BScene.res', text), 'The ruler accepts.'],
        [textKey('BScene.res', text + 1), 'Show it to the ruler.']
      ]);
      const success = use(sim, object, resources);
      expect(success.sim.roster[ruler]).toMatchObject({
        allegiance: 99,
        triggerByte: 0
      });
      expect(success.sim.roster[1]!.objects).toEqual(object === 14 ? [14] : []);
      expect(lines(success)).toEqual(['The ruler accepts.']);
      expect(success.window?.box).toEqual({
        height: successHeight,
        width: 256,
        x: 10,
        y: 5
      });
      sim.roster[ruler] = { ...sim.roster[ruler]!, position: { x: 0, y: 8 } };
      const hint = use(sim, object, resources);
      expect(hint.sim).toBe(sim);
      expect(lines(hint)).toEqual(['Show it to the ruler.']);
      expect(hint.window?.box.width).toBe(hintWidth);
    }
  );

  test('the Palantír shows the vision and keeps its War Event effect', () => {
    // finding:objects-palantir-vision-or-tip
    const sim = { ...carrying(7), rng: seedFor(true) };
    const given = new Set([8]);
    const result = use(
      sim,
      7,
      new Map([[textKey('BScene.res', 37), 'A vision of the nine.']]),
      given
    );
    expect(hasWarEvent(result.sim.warEvents, 7)).toBe(true);
    expect(result.sim.roster[1]!.objects).toEqual([7]);
    expect(lines(result)).toEqual([
      'Looking deep into the crystal, FRODO sees a vision:',
      'A vision of the nine.'
    ]);
    expect(result.window?.box).toEqual({ height: 64, width: 256, x: 10, y: 5 });
    expect(given).toEqual(new Set([8]));
  });

  test('the Palantír spends only tips not yet given by advisors', () => {
    // finding:ui-advisors-share-advice
    const sim = { ...carrying(7), rng: seedFor(false) };
    const given = new Set([8]);
    const resources = new Map([
      [textKey('BScene.res', 9), 'A fresh tip.'],
      [textKey('BScene.res', 10), 'Another tip.']
    ]);
    const first = use(sim, 7, resources, given);
    expect(lines(first)?.[1]).toBe('A fresh tip.');
    expect(given).toEqual(new Set([8, 9]));
    expect(lines(use(sim, 7, resources, given))?.[1]).toBe('Another tip.');
    expect(given).toEqual(new Set([8, 9, 10]));
  });

  test('the Palantír uses a proverb once the session has spent every tip', () => {
    const sim = { ...carrying(7), rng: seedFor(false) };
    const given = new Set(Array.from({ length: 20 }, (_, i) => i + 8));
    const result = use(
      sim,
      7,
      new Map([[textKey('BScene.res', 28), 'A proverb.']]),
      given
    );
    expect(lines(result)?.[1]).toBe('A proverb.');
    expect(given.size).toBe(20);
  });
});
