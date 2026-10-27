import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { EMBLEMS } from '../web/src/view/atlas/emblems';
import {
  EMBLEM_DIR,
  SCALE,
  buildEmblems,
  distanceField,
  toneMasks
} from './build-emblems';

test('has an SVG for every emblem a Force can be drawn with', () => {
  expect(
    EMBLEMS.filter(n => !existsSync(join(EMBLEM_DIR, `${n}.svg`)))
  ).toEqual([]);
});

test('sorts each opaque pixel into its nearest tone', () => {
  const pixels = new Uint8Array([
    // ink, field, parchment device, transparent
    0x3a, 0x2c, 0x1c, 255, 0x30, 0x5a, 0xa0, 255, 0xee, 0xe0, 0xc0, 255, 0, 0,
    0, 0
  ]);
  const { body, device, ink } = toneMasks(pixels, 2);
  expect([...body]).toEqual([1, 1, 1, 0]);
  expect([...ink]).toEqual([1, 0, 0, 0]);
  expect([...device]).toEqual([0, 0, 1, 0]);
});

test('puts the edge of a mask at the field midpoint', () => {
  const field = distanceField(new Uint8Array([1, 1, 0, 0]), 4, 1);
  expect(field[1]!).toBeGreaterThan(128);
  expect(field[2]!).toBeLessThan(128);
});

test('lays the emblems out in cells, three channels each', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="16" y="16" width="32" height="32" fill="#2f58a8"/></svg>';
  const { atlas, data } = buildEmblems([
    { name: 'a', svg },
    { name: 'b', svg }
  ]);
  expect(atlas.cells).toEqual({
    a: { u: 0, v: 0 },
    b: { u: atlas.cell, v: 0 }
  });
  expect(data.length).toBe(atlas.width * atlas.height * 3);
  // The square's centre is field: inside the silhouette, no ink or device.
  const centre =
    ((atlas.margin + 32 * SCALE) * atlas.width + atlas.margin + 32 * SCALE) * 3;
  expect(data[centre + 1]!).toBeGreaterThan(128);
  expect(data[centre]!).toBeLessThan(128);
  expect(data[centre + 2]!).toBeLessThan(128);
});
