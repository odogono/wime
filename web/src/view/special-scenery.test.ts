import { expect, test } from 'bun:test';

import type { SceneStrip } from './animation-scene';
import { placeScenery } from './special-scenery';

// Draws that always return the same pick, n - 1 capped at `pick`.
const always =
  (pick: number) =>
  (n: number): number =>
    Math.min(pick, n - 1);

const before = (): SceneStrip[] => [
  { id: -9045, mirrored: true, x: 10, y: 57 }
];

test('Hobbiton replaces the last strip with hills, then adds houses and grass', () => {
  const strips = before();
  expect(placeScenery(62, always(0), strips)).toEqual({ extra: true });
  expect(strips).toEqual([
    { id: -7536, mirrored: true, x: 0, y: 54 },
    { id: 205, mirrored: false, x: 135, y: 43 },
    { id: -3059, mirrored: false, x: 0, y: 104 }
  ]);
});

test('a town elsewhere may show two cottages instead', () => {
  const strips = before();
  placeScenery(94, always(2), strips);
  expect(strips.map(strip => [strip.id, strip.x, strip.y])).toEqual([
    [201, 2, 29],
    [201, -28, 2 + 29],
    [-3059, 0, 104]
  ]);
});

test('Rivendell and Mount Doom start the list afresh and leave no foreground', () => {
  const rivendell = before();
  expect(placeScenery(188, always(5), rivendell)).toEqual({
    extra: false,
    ground: 0
  });
  expect(rivendell.map(strip => strip.id)).toEqual([-14_956, -3057, 201, 201]);
  const doom = before();
  placeScenery(93, always(0), doom);
  expect(doom.map(strip => strip.id)).toEqual([-16_336, -3057]);
});

test('a tile with no case adds nothing but the extra strip', () => {
  const strips = before();
  expect(placeScenery(7, always(0), strips)).toEqual({ extra: true });
  expect(strips).toEqual(before());
});
