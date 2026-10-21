import { describe, expect, test } from 'bun:test';

import type { RosterEntry } from '../sim/index';
import type { Stage } from './animation-level';
import {
  EYE_HEADING,
  NOBODY_SELECTED,
  carriedLines,
  eyeStatus,
  figureAt,
  figureStatus,
  insideStatusBox,
  isSelectable
} from './animation-status';
import type { Figure } from './figure-script';

const figure = (over: Partial<Figure>): Figure => ({
  clamp: 0,
  delay: 0,
  depth: 150,
  flipped: false,
  frame: 0,
  frml: 1,
  next: 0,
  owner: 7,
  pc: 0,
  returns: [],
  speed: 1,
  x: 100,
  y: 150,
  ...over
});

const frames = () => [{ height: 20, hot_x: 0, hot_y: 0, width: 10 }];
const stage = (figures: Figure[]): Stage => ({ figures, party: 1 });

const entry = (over: Partial<RosterEntry>): RosterEntry =>
  ({
    destination: null,
    health: 7,
    index: 7,
    leader: null,
    maxHealth: 7,
    name: 'FRODO',
    objects: [],
    position: { x: 640, y: 384 },
    startingStrength: 1,
    state: 1,
    strength: 1,
    ...over
  }) as RosterEntry;

const roster = (...entries: RosterEntry[]): RosterEntry[] => {
  const all: RosterEntry[] = [];
  for (const e of entries) {
    all[e.index] = e;
  }
  return all;
};

describe('clicking a figure', () => {
  test('hits the figure whose current frame holds the point', () => {
    const s = stage([figure({})]);
    expect(figureAt(s, frames, { x: 100, y: 150 })).toBe(7);
    expect(figureAt(s, frames, { x: 109, y: 169 })).toBe(7);
    expect(figureAt(s, frames, { x: 110, y: 150 })).toBeNull();
    expect(figureAt(s, frames, { x: 100, y: 170 })).toBeNull();
  });

  test('takes the nearest of overlapping figures, else the first added', () => {
    const s = stage([
      figure({ depth: 150, owner: 7 }),
      figure({ depth: 154, owner: 10 }),
      figure({ depth: 154, owner: 9 })
    ]);
    expect(figureAt(s, frames, { x: 105, y: 160 })).toBe(10);
  });

  test('selects only entries 1 to 78', () => {
    expect([0, 1, 78, 79, 160].map(isSelectable)).toEqual([
      false,
      true,
      true,
      false,
      false
    ]);
  });

  test('shows the status line in a 208 by 24 box', () => {
    const r = roster(
      entry({ index: 7 }),
      entry({ index: 10, leader: 7, name: 'PIPPIN', position: null })
    );
    const box = figureStatus(r, [], 10);
    expect(box).toMatchObject({ height: 24, width: 208 });
    expect(box.lines.map(line => line.text)).toEqual([
      'PIPPIN is following FRODO.'
    ]);
    expect(insideStatusBox(box, { x: 20, y: 10 })).toBe(true);
    expect(insideStatusBox(box, { x: 20, y: 40 })).toBe(false);
  });
});

const names = (n: number): string[] =>
  carriedLines(Array.from({ length: n }, (_, i) => i));

describe('the eye', () => {
  test('asks for a selection with nobody selected', () => {
    const box = eyeStatus([], [], null);
    expect(box.width).toBe(196);
    expect(box.lines.map(line => line.text)).toEqual([NOBODY_SELECTED]);
  });

  test('gives a Character its health and what it carries', () => {
    const r = roster(
      entry({ health: 7, index: 10, leader: 7, name: 'PIPPIN' }),
      entry({ index: 7 })
    );
    const hale = eyeStatus(r, [], 10);
    expect(hale.lines.map(line => line.text)).toEqual([
      EYE_HEADING,
      'PIPPIN is following FRODO.',
      'He is hale and hardy.'
    ]);
    expect(hale.height).toBe(44);
    r[10] = { ...r[10]!, health: 1, objects: [3, 0] };
    const hurt = eyeStatus(r, [], 10);
    expect(hurt.lines.slice(2).map(line => line.text)).toEqual([
      'He is near death.',
      'He has the Ring and an Ancient sword.'
    ]);
    expect(hurt.height).toBe(54);
  });

  test('gives a Unit its morale', () => {
    const r = roster(
      entry({
        destination: null,
        index: 20,
        name: 'infantry',
        startingStrength: 1000,
        strength: 500
      })
    );
    expect(eyeStatus(r, [], 20).lines.at(-1)!.text).toBe(
      'They have fair morale.'
    );
  });

  test('joins object names as the original does', () => {
    expect(names(0)).toEqual([]);
    expect(names(3)[0]).toMatch(/^He has .+, .+, and .+\.$/);
    expect(names(5)[0]).toMatch(/, and $/);
    expect(names(5)[1]).toMatch(/^[^,]+\.$/);
    expect(names(6)[0]).toMatch(/, $/);
    expect(names(6)[1]).toMatch(/^.+, and .+\.$/);
    expect(names(10)).toHaveLength(2);
  });
});
