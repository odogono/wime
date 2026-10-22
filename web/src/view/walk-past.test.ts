import { describe, expect, test } from 'bun:test';

import type { RosterEntry } from '../sim/index';
import { type Stage } from './animation-level';
import { STOPPED, newFigure, type ScriptWorld } from './figure-script';
import { dropPassers, walkPast } from './walk-past';

// The passers' walk: clamp 0xb, then step left until the line.
const script = (): number[] => {
  const bytes = Array.from({ length: 256 }, () => 0x60);
  bytes.splice(0, 6, 0, 0x60, 0x42, 0, 0xa0, 2);
  bytes.splice(0x0a, 4, 0x42, 0, 0xa0, 0x0a);
  bytes.splice(0xb8, 4, 0x8b, 0xa1, 0x0a, 0xbf);
  return bytes;
};
const world: Omit<ScriptWorld, 'laggardLine'> = {
  frames: () => [{ height: 20, hot_x: 0, hot_y: 20, width: 12 }],
  line1: 1000,
  line2: 1000,
  random: () => 0,
  script
};
const party: Stage = {
  figures: [newFigure({ ...world, laggardLine: 0 }, 0, 0, -10, 165, 150, 1)],
  party: 1
};
const scouts = {
  figure: 13,
  index: 159,
  strength: 20
} as RosterEntry;

describe('an Encounter passed by on the Animation Level', () => {
  test('walks past the party, mirrored, to a line off the left edge', () => {
    const stage = walkPast(party, scouts, world, 0);
    const passers = stage.figures.slice(1);
    expect(passers).toHaveLength(3);
    expect(passers.every(f => f.flipped && f.owner === 159)).toBe(true);
    expect(stage.lines?.line2).toBe(-100);
  });

  test('leaves the scene once off the left edge', () => {
    const stage = walkPast(party, scouts, world, 0);
    const gone = {
      ...stage,
      figures: stage.figures.map((f, i) =>
        i === 0 ? f : { ...f, next: STOPPED, x: -103 }
      )
    };
    expect(dropPassers(gone, [1]).figures).toEqual([party.figures[0]!]);
    expect(dropPassers(stage, [1])).toBe(stage);
  });

  test('a still picture does not walk past', () => {
    expect(walkPast(party, { ...scouts, figure: 82 }, world, 0)).toBe(party);
  });
});
