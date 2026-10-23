import { describe, expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../sim/starting-state';
import { forceLabel, sideColour, terrainColour } from './debug-views';

const entry = (index: number, name: string, strength: number) =>
  ({ index, name, strength }) as RosterEntry;

describe('the Debug views', () => {
  test('colour terrain from red at 1% to green at 100%', () => {
    expect(terrainColour(1, 1)).toBe('hsla(1, 90%, 50%, 1)');
    expect(terrainColour(50, 1)).toBe('hsla(60, 90%, 50%, 1)');
    expect(terrainColour(100, 1)).toBe('hsla(120, 90%, 50%, 1)');
  });

  test('colour a Force by its Side', () => {
    expect(sideColour(0)).not.toBe(sideColour(1));
    expect(sideColour(1)).not.toBe(sideColour(99));
    expect(sideColour(99)).toBe(sideColour(2));
  });

  test("label a Force with its Leader's index and name and its strength", () => {
    const leader = entry(30, 'Theoden', 1);
    const force = {
      leader,
      members: [leader, entry(31, 'Riders', 500)]
    } as Force;
    expect(forceLabel(force)).toBe('30 Theoden 501');
  });
});
