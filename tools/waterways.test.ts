import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

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
