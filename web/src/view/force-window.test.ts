import { describe, expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../sim/index';
import { forceWindowLines, layoutInfoWindow } from './force-window';

const entry = (over: Partial<RosterEntry>): RosterEntry =>
  ({
    index: 0,
    isUnit: false,
    name: '',
    strength: 1,
    ...over
  }) as RosterEntry;

const frodo = entry({ index: 7, name: 'FRODO' });
const force: Force = {
  active: true,
  leader: frodo,
  members: [
    frodo,
    entry({ index: 8, name: 'SAM' }),
    entry({ index: 14, isUnit: true, name: 'cavalry', strength: 120 })
  ],
  onMap: true,
  position: { x: 640, y: 368 }
};

describe('force window', () => {
  test('lists the Force Leader first, followers indented after', () => {
    expect(forceWindowLines(force)).toEqual([
      'FRODO',
      '  SAM',
      '  cavalry (120)'
    ]);
  });

  test('a Force of one Unit is a single line with its strength', () => {
    const orcs = entry({
      index: 144,
      isUnit: true,
      name: 'orcs',
      strength: 10_000
    });
    expect(
      forceWindowLines({ ...force, leader: orcs, members: [orcs] })
    ).toEqual(['orcs (10000)']);
  });

  test('the window sits at the top left and fits its longest line', () => {
    const window = layoutInfoWindow(forceWindowLines(force));
    expect(window.x).toBe(2);
    expect(window.y).toBe(2);
    expect(window.height).toBe(3 * 10 + 8);
    // '  cavalry (120)' is 15 characters at 5px each, plus padding.
    expect(window.width).toBe(15 * 5 + 10);
  });
});
