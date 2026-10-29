import { describe, expect, test } from 'bun:test';

import { crossesRiver, crossingsNear, loadWaterways } from './waterways';

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
