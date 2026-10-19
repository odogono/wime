import { describe, expect, test } from 'bun:test';

import { fullMapDots } from './full-map';
import type { RosterEntry } from './starting-state';

const entry = (index: number, over: Partial<RosterEntry>): RosterEntry =>
  ({
    allegiance: 99,
    leader: null,
    position: { x: 1000, y: 400 },
    state: 1,
    triggerByte: 0,
    ...over,
    index
  }) as RosterEntry;

const roster = (entries: RosterEntry[]): RosterEntry[] => {
  const all: RosterEntry[] = [];
  for (const one of entries) {
    all[one.index] = one;
  }
  return all;
};

describe('fullMapDots', () => {
  test('places a dot at a quarter of x and an eighth of y', () => {
    expect(
      fullMapDots(roster([entry(1, { position: { x: 1219, y: 407 } })]))
    ).toEqual([{ blinks: true, colour: 'green', index: 1, x: 304, y: 50 }]);
  });

  test('colours Evil red and the rest green, blinking above allegiance 2', () => {
    const dots = fullMapDots(
      roster([
        entry(1, { allegiance: 0 }),
        entry(2, { allegiance: 1, triggerByte: 1 }),
        entry(3, { allegiance: 2 }),
        entry(4, { allegiance: 3 }),
        entry(5, { allegiance: 99 })
      ])
    );
    expect(dots.map(dot => [dot.index, dot.colour, dot.blinks])).toEqual([
      [5, 'green', true],
      [4, 'green', true],
      [3, 'green', false],
      [2, 'green', false],
      [1, 'red', false]
    ]);
  });

  test('skips sleepers, followers, untriggered unmobilised entries and Encounter figures', () => {
    const dots = fullMapDots(
      roster([
        entry(1, { state: 0 }),
        entry(2, { leader: 3 }),
        entry(3, {}),
        entry(4, { allegiance: 1, triggerByte: 0 }),
        entry(5, { position: null }),
        entry(152, {})
      ])
    );
    expect(dots.map(dot => dot.index)).toEqual([3]);
  });
});
