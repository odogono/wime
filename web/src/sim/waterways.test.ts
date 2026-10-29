import { describe, expect, test } from 'bun:test';

import {
  crossesRiver,
  crossingsNear,
  firstRiverMet,
  loadWaterways,
  riverWithinSquare
} from './waterways';

// One river running down x = 10 from y = 0 to y = 20, with a ford on it
// and an unnamed crossing further off.
const waterways = loadWaterways({
  crossings: [{ at: [10, 10], place: 'SARN FORD' }, { at: [10, 40] }],
  rivers: [
    [
      [10, 0],
      [10, 20]
    ]
  ]
});

describe('loadWaterways', () => {
  test('reads Crossings as points and rivers as lines', () => {
    expect(waterways).toEqual({
      crossings: [
        { place: 'SARN FORD', x: 10, y: 10 },
        { place: null, x: 10, y: 40 }
      ],
      rivers: [
        [
          { x: 10, y: 0 },
          { x: 10, y: 20 }
        ]
      ]
    });
  });

  test('refuses anything else', () => {
    expect(() => loadWaterways({ crossings: [] })).toThrow();
    expect(() =>
      loadWaterways({ crossings: [], rivers: [[[1, 2]]] })
    ).toThrow();
  });
});

describe('crossesRiver', () => {
  test('is true for a way across a river line', () => {
    expect(crossesRiver(waterways, { x: 0, y: 5 }, { x: 20, y: 6 })).toBe(true);
  });

  test('is false for a way that stops short of it or passes its end', () => {
    expect(crossesRiver(waterways, { x: 0, y: 5 }, { x: 9, y: 5 })).toBe(false);
    expect(crossesRiver(waterways, { x: 0, y: 25 }, { x: 20, y: 25 })).toBe(
      false
    );
  });
});

describe('crossingsNear', () => {
  test('lists the Crossings within reach, nearest first', () => {
    expect(crossingsNear(waterways, { x: 10, y: 30 }, 25)).toEqual([
      { place: null, x: 10, y: 40 },
      { place: 'SARN FORD', x: 10, y: 10 }
    ]);
    expect(crossingsNear(waterways, { x: 100, y: 100 }, 15)).toEqual([]);
  });
});

describe('firstRiverMet', () => {
  // Rivers down x = 30 and x = 10, listed far one first.
  const two = loadWaterways({
    crossings: [],
    rivers: [
      [
        [30, 0],
        [30, 20]
      ],
      [
        [10, 0],
        [10, 20]
      ]
    ]
  });

  test('is the river met first from the start of the way', () => {
    expect(firstRiverMet(two, { x: 0, y: 5 }, { x: 40, y: 5 })).toBe(1);
    expect(firstRiverMet(two, { x: 40, y: 5 }, { x: 0, y: 5 })).toBe(0);
    expect(firstRiverMet(two, { x: 0, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });

  test('passes over the rivers it is told to skip', () => {
    expect(firstRiverMet(two, { x: 0, y: 5 }, { x: 40, y: 5 }, [1])).toBe(0);
  });
});

describe('riverWithinSquare', () => {
  test('is true when the line passes through the square around a point', () => {
    const line = waterways.rivers[0]!;
    expect(riverWithinSquare(line, { x: 25, y: 10 }, 15)).toBe(true);
    expect(riverWithinSquare(line, { x: 26, y: 10 }, 15)).toBe(false);
    expect(riverWithinSquare(line, { x: 20, y: 34 }, 15)).toBe(true);
    expect(riverWithinSquare(line, { x: 20, y: 36 }, 15)).toBe(false);
  });
});
