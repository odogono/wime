import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { Point } from '../web/src/sim/starting-state';
import { crossingsNear, loadWaterways } from '../web/src/sim/waterways';
import { CROSSING_TILES } from './build-geography';
import { ASSETS, hasAssets, loadTileGrid } from './terrain-equivalence';

const TILE = 16;

const WATERWAYS = join(ASSETS, 'geography/waterways.json');

const load = async () => loadWaterways(await Bun.file(WATERWAYS).json());

// The Places that stand on a road over a river
// (finding:movement-fords-and-bridges-are-crossing-tiles).
const NAMED_CROSSINGS = [
  'SARN FORD',
  'OSGILIATH',
  'FORD OF BRUINEN',
  'ISEN FORD',
  'STONEBOWS BRIDGE',
  'THE LAST BRIDGE',
  'PELARGIR'
];

// Skips without the exported assets (`bun run extract-all`), as in CI.
const skip = !hasAssets() || !existsSync(WATERWAYS);

test.skipIf(skip)('every named crossing Place is a Crossing', async () => {
  const places = (await load()).crossings.map(c => c.place);
  expect(NAMED_CROSSINGS.filter(name => !places.includes(name))).toEqual([]);
});

test.skipIf(skip)(
  'every road-over-river tile has a Crossing on it',
  async () => {
    const waterways = await load();
    const { tilemap } = await loadTileGrid();
    const missing: string[] = [];
    tilemap.indices.forEach((tile, i) => {
      const x = (i % tilemap.width) * TILE + TILE / 2;
      const y = Math.floor(i / tilemap.width) * TILE + TILE / 2;
      if (
        CROSSING_TILES.includes(tile) &&
        !crossingsNear(waterways, { x, y }, TILE).length
      ) {
        missing.push(`tile ${tile} at ${x},${y}`);
      }
    });
    expect(missing).toEqual([]);
  }
);

// A traced Crossing stands on a road-over-river tile, or within a tile
// of one where the roads are traced a few pixels off it (#337).
test.skipIf(skip)(
  'every Crossing has a road-over-river tile within a tile',
  async () => {
    const waterways = await load();
    const { tilemap } = await loadTileGrid();
    const tiles: [number, number][] = [];
    tilemap.indices.forEach((tile, i) => {
      if (CROSSING_TILES.includes(tile)) {
        tiles.push([
          (i % tilemap.width) * TILE + TILE / 2,
          Math.floor(i / tilemap.width) * TILE + TILE / 2
        ]);
      }
    });
    const stray = waterways.crossings
      .filter(c => !tiles.some(([x, y]) => Math.hypot(x - c.x, y - c.y) < TILE))
      .map(c => `${c.x},${c.y} ${c.place ?? ''}`);
    expect(stray).toEqual([]);
  }
);

// How far a point lies from the segment ab.
const fromSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)
    )
  );
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
};

// Crossing movement looks for the river a Crossing spans (#338).
test.skipIf(skip)(
  'every Crossing lies within a tile of a river line',
  async () => {
    const { crossings, rivers } = await load();
    const far = crossings.filter(
      c =>
        !rivers.some(river =>
          river.some(
            (p, i) => i > 0 && fromSegment(c, river[i - 1]!, p) <= TILE
          )
        )
    );
    expect(far).toEqual([]);
  }
);
