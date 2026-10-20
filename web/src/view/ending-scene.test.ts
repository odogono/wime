import { describe, expect, test } from 'bun:test';

import { endingFigures } from './ending-scene';

// Rolls of 0 give each figure its base place
// (finding:ui-ending-scenes-are-still-pictures).
const none = (): number => 0;
// The highest roll of each.
const top = (n: number): number => n - 1;

describe('the ending scenes', () => {
  test('a loss: four rows of twelve orcs, two trolls, a balrog, nine hooded figures in front', () => {
    const figures = endingFigures('lost-strongholds', none);
    const orcs = figures.filter(figure => figure.frml === 6);
    expect(orcs).toHaveLength(48);
    expect(orcs[0]).toEqual({
      flipped: false,
      frame: 13,
      frml: 6,
      x: -20,
      y: 106
    });
    expect(orcs.at(-1)).toMatchObject({ x: 310, y: 130 });
    expect(
      figures.filter(figure => figure.frml !== 6 && figure.frml !== 8)
    ).toEqual([
      { flipped: false, frame: 11, frml: 9, x: 18, y: 90 },
      { flipped: true, frame: 1, frml: 12, x: 240, y: 83 },
      { flipped: false, frame: 8, frml: 9, x: 2, y: 95 }
    ]);
    const hooded = figures.slice(-9);
    expect(hooded.map(figure => figure.x)).toEqual([
      10, 43, 76, 109, 142, 175, 208, 241, 274
    ]);
    expect(
      hooded.every(f => f.frml === 8 && f.frame === 13 && f.y === 140)
    ).toBe(true);
  });

  test('the rolls pick the orcs’ frames 10 to 13 and jitter every figure', () => {
    const [orc] = endingFigures('lost-barad-dur', top);
    expect(orc).toEqual({ flipped: true, frame: 10, frml: 6, x: 4, y: 112 });
  });

  test('a win: the Fellowship in a row, drawn from the right, the right five facing left', () => {
    const figures = endingFigures('won-mount-doom', none);
    expect(figures.map(f => [f.frml, f.frame, f.x, f.y, f.flipped])).toEqual([
      [2, 16, 245, 130, true],
      [0, 16, 220, 140, true],
      [0, 16, 195, 140, true],
      [2, 16, 170, 128, true],
      [4, 15, 145, 114, true],
      [0, 16, 120, 140, false],
      [1, 15, 95, 130, false],
      [0, 16, 70, 140, false],
      // FRML 3 has no frame 17: the original's dwarf is never seen.
      [3, 17, 45, 140, false]
    ]);
    expect(endingFigures('won-barad-dur', none)).toEqual(figures);
  });
});
