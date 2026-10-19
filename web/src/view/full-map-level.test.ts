import { describe, expect, test } from 'bun:test';

import type { FullMapDot } from '../sim/index';
import {
  DOT_COLOUR_INDEX,
  dotFills,
  fullMapIconPlacements,
  type FullMapIcon
} from './full-map-level';

const icon = (
  name: FullMapIcon['name'],
  width: number,
  height: number
): FullMapIcon => ({
  image: { height, width } as FullMapIcon['image'],
  name
});

const dot = (over: Partial<FullMapDot>): FullMapDot => ({
  blinks: false,
  colour: 'green',
  index: 1,
  x: 0,
  y: 0,
  ...over
});

describe('fullMapIconPlacements', () => {
  test('centres each icon where the original does', () => {
    expect(
      fullMapIconPlacements([
        icon('eye', 40, 10),
        icon('scroll', 35, 16),
        icon('magnifying-glass', 31, 15),
        icon('hourglass', 22, 14)
      ]).map(({ icon, x, y }) => [icon.name, x, y])
    ).toEqual([
      ['eye', 580, 5],
      ['scroll', 583, 16],
      ['magnifying-glass', 585, 35],
      ['hourglass', 589, 54]
    ]);
  });
});

describe('dotFills', () => {
  const dots = [
    dot({ colour: 'red', index: 3 }),
    dot({ blinks: true, index: 2 }),
    dot({ index: 1 })
  ];

  test('draws every dot in its base colour, then the blinking ones over them', () => {
    expect(
      dotFills(dots, true).map(fill => [fill.dot.index, fill.colourIndex])
    ).toEqual([
      [3, DOT_COLOUR_INDEX.red],
      [2, DOT_COLOUR_INDEX.green],
      [1, DOT_COLOUR_INDEX.green],
      [2, DOT_COLOUR_INDEX.blinkOn]
    ]);
  });

  test('blinks to cream in the other phase', () => {
    expect(dotFills(dots, false).at(-1)?.colourIndex).toBe(
      DOT_COLOUR_INDEX.blinkOff
    );
  });
});
