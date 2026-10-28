import { describe, expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../sim/starting-state';
import {
  classicProjection,
  forceLabel,
  projectionOf,
  sideColour,
  terrainColour,
  terrainRgba
} from './debug-views';

const entry = (index: number, name: string, strength: number) =>
  ({ index, name, strength }) as RosterEntry;

const near = (rgba: number[], expected: number[]) =>
  rgba.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 5));

describe('the Debug views', () => {
  test('place the Classic view one native pixel to a world pixel', () => {
    const view = classicProjection({ x: 100, y: 40 });
    expect(view.scale).toBe(1);
    expect(view.toScreen({ x: 110, y: 50 })).toEqual({ x: 10, y: 10 });
    expect(view.toWorld({ x: 10, y: 10 })).toEqual({ x: 110, y: 50 });
  });

  test("read a zoomed projection's scale off its mapping", () => {
    const view = projectionOf(
      ({ x, y }) => ({ x: (x - 100) * 3, y: (y - 40) * 3 }),
      ({ x, y }) => ({ x: x / 3 + 100, y: y / 3 + 40 }),
      { height: 600, width: 960 }
    );
    expect(view.scale).toBe(3);
    expect(view.toScreen({ x: 110, y: 50 })).toEqual({ x: 30, y: 30 });
  });

  test('colour terrain from red at 1% to green at 100%', () => {
    expect(terrainColour(1, 1)).toBe('hsla(1, 90%, 50%, 1)');
    expect(terrainColour(50, 1)).toBe('hsla(60, 90%, 50%, 1)');
    expect(terrainColour(100, 1)).toBe('hsla(120, 90%, 50%, 1)');
  });

  test('give the Atlas map the terrain colours as numbers', () => {
    near(terrainRgba(50, 1), [0.95, 0.95, 0.05, 1]);
    near(terrainRgba(100, 0.45), [0.05, 0.95, 0.05, 0.45]);
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
