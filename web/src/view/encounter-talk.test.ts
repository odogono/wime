import { describe, expect, test } from 'bun:test';

import {
  createSim,
  tickSim,
  type RosterEntry,
  type SimState
} from '../sim/index';
import { type Stage } from './animation-level';
import {
  BOX_MS,
  PICTURE_PARTING_MS,
  drawTip,
  greetingText,
  partingText,
  partyAfterTalk,
  pressEncounterTalk,
  startEncounterTalk,
  stepEncounterTalk,
  talkLines
} from './encounter-talk';
import { STOPPED, newFigure, type ScriptWorld } from './figure-script';
import { passingText, takePassingMessage } from './passing-message';

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
  test('greets the watched Character, then gives a tip in the same box', () => {
    const picks = [2, 1, 3];
    expect(
      greetingText('FRODO', texts, new Set(), n => {
        const pick = picks.shift()!;
        expect(pick).toBeLessThan(n);
        return pick;
      })
    ).toBe('Hello FRODO, greeting 2.\nCSTR 11.');
    expect(picks).toEqual([]);
  });

  test('parts with one of CSTR 4 to 7, a proverb three times in four, and a farewell', () => {
    const given = new Set<number>();
    // Prefix, tip, proverb-or-tip, farewell, proverb.
    const picks = [3, 1, 2, 3, 5];
    expect(partingText(texts, given, () => picks.shift()!)).toBe(
      'CSTR 7. CSTR 33. Goodbye!'
    );
    // The tip is spent though the proverb was shown.
    expect([...given]).toEqual([9]);
    expect(partingText(texts, given, zero)).toBe('CSTR 4. CSTR 8. Farewell!');
  });

  test('rerolls a given tip up to 50 times, then repeats the last roll', () => {
    const given = new Set([8]);
    let rolls = 0;
    expect(
      drawTip(given, () => {
        rolls++;
        return 0;
      })
    ).toBe(8);
    expect(rolls).toBe(50);
    const fresh = new Set<number>();
    expect(drawTip(fresh, n => n - 1)).toBe(27);
    expect([...fresh]).toEqual([27]);
  });
});

// A script whose entries stand for the original's: the party's walk to
// its line raises event 6, and the advisor's talk holds the party, opens
// the greeting, waits 25 frames, opens the parting, waits, and sets the
// party walking on.
const talkScript = (): number[] => {
  const bytes = Array.from({ length: 256 }, () => 0x60);
  bytes[0] = 0;
  bytes[0x02] = 0x00;
  bytes[0x03] = 0xa0;
  bytes[0x04] = 0x02;
  bytes.splice(0xa0, 2, 0x86, 0xbf);
  bytes.splice(0xb8, 2, 0x87, 0xbf);
  bytes.splice(0xe6, 6, 0x83, 0x8c, 0x61, 0x8d, 0x61, 0x85);
  return bytes;
};
const world: ScriptWorld = {
  frames: () => [{ height: 20, hot_x: 0, hot_y: 20, width: 12 }],
  laggardLine: 0,
  line1: 1000,
  line2: 1000,
  random: zero,
  script: talkScript
};
const party: Stage = {
  figures: [newFigure(world, 0, 0, -10, 165, 150, 0)],
  party: 1
};
const frodo = entry(0, 'FRODO');
const lines = { line1: 70, line2: 170 };

describe('Animation Level talk', () => {
  test('stops the party at x 70, or 160 when it had walked past 70', () => {
    expect(talkLines(null)).toEqual({ line1: 70, line2: 150 });
    expect(talkLines(party)).toEqual({ line1: 70, line2: 170 });
    const past = {
      ...party,
      figures: [{ ...party.figures[0]!, x: 70 }]
    };
    expect(talkLines(past)).toEqual({ line1: 160, line2: 260 });
  });

  test("a walking advisor's script holds the party, greets, parts and lets it walk on", () => {
    const given = new Set<number>();
    const radagast = entry(157, 'RADAGAST', { figure: 4 });
    const before = JSON.stringify([frodo, radagast, party]);
    const talk = startEncounterTalk(
      frodo,
      radagast,
      party,
      lines,
      world,
      texts,
      given,
      zero,
      0,
      true
    );
    expect(talk.box?.text).toBe('FRODO meets RADAGAST.');
    expect(talk.stage.figures[1]).toMatchObject({ flipped: true, owner: 157 });
    const greeting = stepEncounterTalk(talk, world, 0)!;
    expect(greeting.box?.text).toBe('Greetings FRODO, greeting 0.\nCSTR 8.');
    expect(greeting.stage.figures[0]!.next).toBe(STOPPED);
    expect(given.size).toBe(1);
    // The greeting stays until the script parts; a press does nothing.
    expect(pressEncounterTalk(greeting)).toBe(greeting);
    const parting = stepEncounterTalk(greeting, world, 25 * 20)!;
    expect(parting.parting).toBe(true);
    // A roll of 0 gives a tip, here a repeat once every reroll fails.
    expect(parting.box?.text).toBe('CSTR 4. CSTR 8. Farewell!');
    expect(parting.stage.lines?.line2).toBe(-50);
    const walking = stepEncounterTalk(parting, world, 50 * 20)!;
    expect(walking.stage.figures[0]!.next).not.toBe(STOPPED);
    expect(pressEncounterTalk(walking)).toBeNull();
    expect(stepEncounterTalk(walking, world, 25 * 20 + BOX_MS)).toBeNull();
    expect(partyAfterTalk(walking).figures.map(f => f.owner)).toEqual([0]);
    expect(JSON.stringify([frodo, radagast, party])).toBe(before);
  });

  test('a still picture greets when the party reaches its line and parts 600 frames later', () => {
    const talk = startEncounterTalk(
      frodo,
      entry(153, 'TOM BOMBADIL', { allegiance: 3, figure: 82 }),
      party,
      lines,
      world,
      texts,
      new Set(),
      zero,
      0,
      false,
      44
    );
    expect(talk.box).toBeNull();
    expect(talk.picture).toEqual({ id: 82, x: 158, y: 130 });
    expect(talk.stage.figures).toHaveLength(1);
    const greeting = stepEncounterTalk(talk, world, 0)!;
    expect(greeting.box?.text).toContain('Greetings FRODO');
    const waiting = stepEncounterTalk(
      greeting,
      world,
      PICTURE_PARTING_MS - 20
    )!;
    expect(waiting.parting).toBe(false);
    const parting = stepEncounterTalk(waiting, world, PICTURE_PARTING_MS)!;
    expect(parting.parting).toBe(true);
    expect(
      stepEncounterTalk(parting, world, PICTURE_PARTING_MS + BOX_MS)
    ).toBeNull();
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

  test('words the Ring’s passing after a fight', () => {
    // docs/spec/winning-and-losing.md, "After a fight".
    const sim = passingSim();
    expect(passingText(sim, { bearer: 0, kind: 'ring' })).toBe(
      'FRODO now has the RING.'
    );
    expect(passingText(sim, { kind: 'nazgul-sent' })).toBe(
      'The 3rd NAZGUL is sent to the site.'
    );
  });

  test('takes each passing once, in order, and never holds the clock', () => {
    const sim = passingSim();
    const first = takePassingMessage(sim);
    expect(first.message).toEqual({ text: 'FRODO passes a Ranger.' });
    expect(first.sim.passings).toHaveLength(1);
    const second = takePassingMessage(first.sim);
    expect(second.message).not.toBeNull();
    expect(second.sim.passings).toEqual([]);
    expect(takePassingMessage(second.sim).message).toBeNull();
    expect(tickSim(second.sim).clock).not.toEqual(second.sim.clock);
  });
});
