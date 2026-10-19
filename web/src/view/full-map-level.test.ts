import { describe, expect, test } from 'bun:test';

import type { FullMapDot } from '../sim/index';
import {
  DOT_COLOUR_INDEX,
  campaignCameraFor,
  dotFills,
  fullMapIconAt,
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

describe('campaignCameraFor', () => {
  // The 160 by 99 tile Campaign Level map, 16 pixel tiles.
  const tilemap = {
    height: 99,
    indices: [],
    stride: 160,
    tile_height: 16,
    tile_width: 16,
    width: 160
  };

  test('centres the clicked spot on the Campaign Level', () => {
    // Hobbiton's dot is at (304, 50); the view is 320 by 192.
    expect(campaignCameraFor({ x: 304, y: 50 }, tilemap)).toEqual({
      x: 1218 - 160,
      y: 404 - 96
    });
  });

  test('clamps to the edges of the map', () => {
    expect(campaignCameraFor({ x: 0, y: 0 }, tilemap)).toEqual({ x: 0, y: 0 });
    expect(campaignCameraFor({ x: 639, y: 199 }, tilemap)).toEqual({
      x: 160 * 16 - 320,
      y: 99 * 16 - 192
    });
  });
});

describe('fullMapIconAt', () => {
  const placements = fullMapIconPlacements([icon('magnifying-glass', 31, 15)]);

  test('finds the icon under a hi-res point', () => {
    expect(fullMapIconAt(placements, { x: 600, y: 42 })?.icon.name).toBe(
      'magnifying-glass'
    );
    expect(fullMapIconAt(placements, { x: 300, y: 42 })).toBeUndefined();
  });
});
