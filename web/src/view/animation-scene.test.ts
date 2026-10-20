import { describe, expect, test } from 'bun:test';

import {
  isWide,
  layoutScene,
  originalRandom,
  placeClouds,
  sceneStep,
  skyColour,
  type AnimationTables
} from './animation-scene';

const tables = (over: Partial<AnimationTables> = {}): AnimationTables => ({
  figure_scripts: [],
  foreground_lists: [[300]],
  foreground_offsets: [20],
  scene_words: Array<number>(256).fill(0),
  scenery_lists: [[{ choices: [0x12_34], optional: false, parallax: 4 }]],
  sky_colours: [4, 4, 10, 11, 12, 12, 12, 12, 11, 10, 4, 4],
  sky_colours_dark: [16, 4, 5, 5, 4, 16],
  ...over
});

// A 4 by 4 tile map whose every tile byte is its index.
const tilemap = { indices: Array.from({ length: 16 }, (_, i) => i), width: 4 };

test("originalRandom steps the seed by 125 modulo 0x2aaaab, as the original's generator", () => {
  const random = originalRandom(1);
  expect(random.next(1000)).toBe(125);
  expect(random.seed()).toBe(125);
  expect(random.next(1000)).toBe(15_625 % 1000);
  expect(random.next(0x2a_aa_ab)).toBe(1_953_125);
  // 1953125 * 125 wraps the modulus.
  expect(random.next(0x2a_aa_ab)).toBe((1_953_125 * 125) % 0x2a_aa_ab);
});

describe('sceneStep', () => {
  const words = Array.from({ length: 256 }, (_, i) => 0x1_00 | i);

  test('reads the scene word of the tile under the centre of the Character', () => {
    expect(sceneStep(tilemap, words, { x: 16, y: 16 }, 2)).toEqual({
      dark: false,
      sub: 0,
      tile: 5,
      word: 0x1_05
    });
    // (x + 8, y + 8) is in the next tile from 8 pixels on.
    expect(sceneStep(tilemap, words, { x: 24, y: 16 }, 2).tile).toBe(6);
  });

  test('measures how far into the tile it is, from the far side when facing west', () => {
    expect(sceneStep(tilemap, words, { x: 19, y: 16 }, 2).sub).toBe(6);
    expect(sceneStep(tilemap, words, { x: 19, y: 16 }, 6).sub).toBe(26);
    // On a column of tile origins the y offset counts.
    expect(sceneStep(tilemap, words, { x: 16, y: 21 }, 4).sub).toBe(10);
  });

  test('darkens and remaps the scenery lists in the south-east, and Mount Doom is list 16', () => {
    const big = { indices: Array<number>(200 * 200).fill(7), width: 200 };
    const seWords = Array<number>(256).fill(0x2_01);
    expect(sceneStep(big, seWords, { x: 0x6_90, y: 0x3_e0 }, 0)).toMatchObject({
      dark: true,
      word: 0x2_04
    });
    expect(sceneStep(big, seWords, { x: 0x7_00, y: 0x4_50 }, 0).word).toBe(
      0x2_10
    );
    expect(sceneStep(big, seWords, { x: 0x6_8f, y: 0x3_e0 }, 0).dark).toBe(
      false
    );
  });
});

describe('layoutScene', () => {
  const step = { dark: false, sub: 0, tile: 1, word: 0 };

  test('is the same for the same tile every time', () => {
    const a = layoutScene(tables(), step, { x: 32, y: 48 });
    expect(layoutScene(tables(), step, { x: 32, y: 48 })).toEqual(a);
    expect(layoutScene(tables(), step, { x: 48, y: 48 })).not.toEqual(a);
  });

  test("places a group's strip with the tile's random numbers, then the foreground rows", () => {
    const random = originalRandom(((48 / 16) << 16) | (32 / 16)).next;
    // Picking from a group of one still steps the generator.
    random(1);
    const x = random(320);
    const y = random((0x12_34 & 0x3f_80) >> 7);
    const mirrored = random(2) !== 0;
    const strips = layoutScene(tables(), step, { x: 32, y: 48 });
    expect(strips[0]).toEqual({ id: 0x12_34, mirrored, x, y });
    // Rows at y 128, 138, 148 and 158 above the piece's offset.
    expect(strips.slice(1).map(strip => strip.y)).toEqual([108, 118, 128, 138]);
    expect(strips.slice(1).every(strip => strip.id === 300)).toBe(true);
  });

  test('a fixed-height strip keeps its height, and parallax shifts by the sub-position', () => {
    const fixed = tables({
      foreground_lists: [[]],
      scenery_lists: [
        [{ choices: [0x40_00 | (50 << 7)], optional: false, parallax: 4 }]
      ]
    });
    const [still] = layoutScene(fixed, step, { x: 0, y: 0 });
    const [moved] = layoutScene(fixed, { ...step, sub: 10 }, { x: 0, y: 0 });
    expect(still!.y).toBe(50);
    expect(moved!.x).toBe(still!.x - 40);
  });

  test('a set piece of 0x20 to 0x60 stands alone on a tile origin', () => {
    const strips = layoutScene(
      tables({ scenery_lists: [[]] }),
      { ...step, word: 0x60 },
      { x: 0, y: 0 }
    );
    expect(strips).toEqual([
      { id: 0x5a_26, mirrored: strips[0]!.mirrored, x: 0, y: 52 }
    ]);
  });
});

test('isWide marks strips with bit 15 set, except 0xc030', () => {
  expect(isWide(-3059)).toBe(true);
  expect(isWide(0xc0_30 - 0x1_00_00)).toBe(false);
  expect(isWide(300)).toBe(false);
});

test('the sky follows the hour, darker in the south-east', () => {
  expect(skyColour(tables(), 0, false)).toBe(4);
  expect(skyColour(tables(), 40, false)).toBe(12);
  expect(skyColour(tables(), 40, true)).toBe(5);
});

const always = (n: number) => n - 1;

test('clouds come only by day and outside the south-east', () => {
  expect(placeClouds(10, false, always)).toEqual([]);
  expect(placeClouds(40, true, always)).toEqual([]);
  expect(placeClouds(40, false, always)).toEqual(
    Array(3).fill({ id: 0x5_05, mirrored: true, x: 0x1_49 - 10, y: 14 })
  );
});
