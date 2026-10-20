import { describe, expect, test } from 'bun:test';

import {
  createSim,
  tickSim,
  type RosterEntry,
  type SimState
} from '../sim/index';
import { type Stage } from './animation-level';
import {
  NOTICE_MS,
  advanceEncounterTalk,
  adviceBoxes,
  drawTip,
  startEncounterTalk,
  stepEncounterTalk,
  wrapAdvice
} from './encounter-talk';
import { STOPPED, newFigure, type ScriptWorld } from './figure-script';
import { passingText, stepPassingMessage } from './passing-message';

const entry = (
  index: number,
  name: string,
  over: Partial<RosterEntry> = {}
): RosterEntry => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  fraction: 0,
  health: 1,
  icon: 0,
  index,
  isUnit: false,
  leader: null,
  maxHealth: 1,
  maxStamina: 40,
  name,
  objects: [],
  position: { x: 1360, y: 960 },
  route: 0,
  speed: 2,
  stamina: 40,
  startingStrength: 1,
  state: 1,
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  triggerByte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

// Resource labels expose the chosen CSTR IDs without committing any
// text extracted from the original game.
const texts = new Map(
  Array.from({ length: 34 }, (_, id) => [
    `BScene.res#${id}`,
    id < 4 ? `, greeting ${id}.` : `CSTR ${id}.`
  ])
);
const zero = (): number => 0;

describe('advisor advice', () => {
  test('greets the watched Character and speaks three boxes from the shared pool', () => {
    const picks = [1, 2, 3, 2, 1, 5, 3];
    expect(
      adviceBoxes('FRODO', texts, new Set(), n => {
        const pick = picks.shift()!;
        expect(pick).toBeLessThan(n);
        return pick;
      })
    ).toEqual([
      'Hello FRODO, greeting 2.',
      'CSTR 11.',
      'CSTR 6. CSTR 33. Goodbye!'
    ]);
    expect(picks).toEqual([]);
  });

  test('draws each of twenty tips once, including with a constant RNG', () => {
    for (const random of [zero, (n: number) => n - 1]) {
      const given = new Set<number>();
      const drawn = Array.from({ length: 20 }, () => drawTip(given, random));
      expect(new Set(drawn).size).toBe(20);
      expect([...given].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 8)
      );
      expect(
        drawTip(given, () => {
          throw new Error('exhausted pool draws no random number');
        })
      ).toBeNull();
    }
  });

  test('parting may give a second unused tip, sharing the same history', () => {
    const given = new Set<number>();
    expect(adviceBoxes('SAM', texts, given, zero)).toEqual([
      'Greetings SAM, greeting 0.',
      'CSTR 8.',
      'CSTR 4. CSTR 9. Farewell!'
    ]);
    expect([...given]).toEqual([8, 9]);
    expect(adviceBoxes('FRODO', texts, given, zero)[1]).toBe('CSTR 10.');
  });

  test('CSTR 8 as a parting prefix is counted, and never repeats', () => {
    const given = new Set<number>([9]);
    const picks = [0, 0, 1, 4, 1, 0, 0];
    const boxes = adviceBoxes('FRODO', texts, given, () => picks.shift()!);
    expect(boxes[1]).toBe('CSTR 10.');
    expect(boxes[2]).toBe('CSTR 8. CSTR 28. Farewell!');
    expect(given.has(8)).toBe(true);
    const repeated = [0, 0, 0, 4, 1, 0, 0];
    expect(adviceBoxes('SAM', texts, given, () => repeated.shift()!)[2]).toBe(
      'CSTR 4. CSTR 28. Farewell!'
    );
  });

  test('exhausted tips fall back to proverbs without resetting the session', () => {
    const given = new Set(Array.from({ length: 20 }, (_, i) => i + 8));
    expect(adviceBoxes('FRODO', texts, given, zero)).toEqual([
      'Greetings FRODO, greeting 0.',
      'CSTR 28.',
      'CSTR 4. CSTR 28. Farewell!'
    ]);
    expect(given.size).toBe(20);
  });

  test('reflows long text into readable lines', () => {
    expect(wrapAdvice('One two\nthree   four five', 10)).toEqual([
      'One two',
      'three four',
      'five'
    ]);
  });
});

const world: ScriptWorld = {
  frames: () => [{ height: 20, hot_x: 0, hot_y: 20, width: 12 }],
  laggardLine: 0,
  line1: 1000,
  line2: 1000,
  random: zero,
  script: () => [0, 0, 0xe1, 0x41, 0, 0xa0, 2]
};
const party: Stage = {
  figures: [newFigure(world, 0, 0, -10, 165, 150, 0)],
  party: 1
};
const frodo = entry(0, 'FRODO');

describe('Animation Level talk', () => {
  test('starts with one meeting line, then advances three boxes and finishes', () => {
    const advisor = entry(153, 'TOM BOMBADIL', { allegiance: 3, figure: 82 });
    const before = JSON.stringify([frodo, advisor, party]);
    const talk = startEncounterTalk(
      frodo,
      advisor,
      party,
      world,
      texts,
      new Set(),
      zero,
      100
    );
    expect(talk.text).toBe('FRODO meets TOM BOMBADIL.');
    expect(talk.picture).toBe(82);
    expect(talk.advisor.figures).toEqual([]);
    expect(talk.party.figures[0]!.x).toBeGreaterThan(0);
    expect(stepEncounterTalk(talk, world, 100 + NOTICE_MS - 1)?.page).toBe(-1);
    const greeting = stepEncounterTalk(talk, world, 100 + NOTICE_MS)!;
    expect(greeting.page).toBe(0);
    const tip = advanceEncounterTalk(greeting, 5000)!;
    const parting = advanceEncounterTalk(tip, 6000)!;
    expect([greeting.text, tip.text, parting.text]).toEqual(talk.boxes);
    expect(advanceEncounterTalk(parting, 7000)).toBeNull();
    expect(stepEncounterTalk(parting, world, parting.until)).toBeNull();
    expect(JSON.stringify([frodo, advisor, party])).toBe(before);
  });

  test('a talk left early spends only the tips it showed', () => {
    const given = new Set<number>();
    const talk = startEncounterTalk(
      frodo,
      entry(157, 'RADAGAST', { figure: 4 }),
      party,
      world,
      texts,
      given,
      zero,
      0
    );
    expect(given.size).toBe(0);
    const greeting = advanceEncounterTalk(talk, 1)!;
    expect(given.size).toBe(0);
    advanceEncounterTalk(greeting, 2);
    expect([...given]).toEqual([8]);
  });

  test('a walking advisor approaches from the right and stops beside the party', () => {
    const talk = startEncounterTalk(
      frodo,
      entry(157, 'RADAGAST', { figure: 4 }),
      party,
      world,
      texts,
      new Set(),
      zero,
      0
    );
    expect(talk.picture).toBeNull();
    expect(talk.advisor.figures[0]).toMatchObject({
      flipped: true,
      owner: 157,
      x: 330
    });
    const halfway = stepEncounterTalk(talk, world, NOTICE_MS / 2)!;
    expect(halfway.advisor.figures[0]!.x).toBe(255);
    const arrived = stepEncounterTalk(halfway, world, NOTICE_MS)!;
    expect(arrived.advisor.figures[0]).toMatchObject({ next: STOPPED, x: 180 });
    expect(arrived.party).toEqual(talk.party);
  });
});

const passingSim = (): SimState => ({
  ...createSim(1),
  passings: [
    { a: 0, b: 1 },
    { a: 0, b: 1 }
  ],
  roster: [frodo, entry(1, 'a Ranger')]
});

describe('passing notices', () => {
  test('Very Hasty keeps a notice for 60 frames and preserves its time while covered', () => {
    const shown = stepPassingMessage(null, passingSim(), 0, true, 'very-hasty');
    expect(shown.message?.until).toBe(1200);
    const part = stepPassingMessage(
      shown.message,
      shown.sim,
      200,
      true,
      'very-hasty'
    );
    const held = stepPassingMessage(
      part.message,
      part.sim,
      10_000,
      false,
      'very-hasty'
    );
    expect(held.message?.until).toBe(11_000);
    const next = stepPassingMessage(
      held.message,
      held.sim,
      11_000,
      true,
      'very-hasty'
    );
    expect(next.message?.until).toBe(12_200);
    expect(
      stepPassingMessage(next.message, next.sim, 12_200, true, 'very-hasty')
        .message
    ).toBeNull();
  });

  test('words Characters, Units, and the Rohirrim challenge as specified', () => {
    const sim = passingSim();
    expect(passingText(sim, { a: 0, b: 1 })).toBe('FRODO passes a Ranger.');
    sim.roster[0] = entry(0, 'infantry', { isUnit: true, strength: 500 });
    expect(passingText(sim, { a: 0, b: 1 })).toBe(
      '500 infantry pass by a Ranger.'
    );
    sim.roster[0] = frodo;
    sim.roster[1] = entry(1, 'Rohirrim scouts', { figure: 13, strength: 20 });
    expect(passingText(sim, { a: 0, b: 1 })).toBe(
      'FRODO is challenged by 20 Rohirrim scouts.'
    );
  });

  test('consumes each passing, preserves time behind windows, and never holds the clock', () => {
    const sim = passingSim();
    expect(stepPassingMessage(null, sim, 0, false)).toEqual({
      message: null,
      sim
    });
    const first = stepPassingMessage(null, sim, 100, true);
    expect(first.sim.passings).toHaveLength(1);
    expect(first.message?.text).toBe('FRODO passes a Ranger.');
    const elapsed = stepPassingMessage(first.message, first.sim, 1100, true);
    const held = stepPassingMessage(
      elapsed.message,
      elapsed.sim,
      50_000,
      false
    );
    expect(held.message?.remaining).toBe(3000);
    expect(held.message?.until).toBe(53_000);
    expect(held.sim).toBe(elapsed.sim);
    const second = stepPassingMessage(held.message, held.sim, 53_000, true);
    expect(second.sim.passings).toEqual([]);
    expect(second.message).not.toBeNull();
    expect(
      stepPassingMessage(second.message, second.sim, 53_000 + NOTICE_MS, true)
        .message
    ).toBeNull();
    expect(tickSim(second.sim).clock).not.toEqual(second.sim.clock);
    expect(second.sim.roster).toEqual(sim.roster);
  });
});
