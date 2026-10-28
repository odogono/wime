import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

import { terrainAt } from '../web/src/sim/movement';
import { loadTerrainRegions, terrainGridFrom } from '../web/src/sim/terrain';
import type { Geography, Ring } from './build-geography';
import {
  ASSETS,
  compareTerrain,
  gridTerrainAt,
  hasAssets,
  loadEquivalence,
  loadTileGrid
} from './terrain-equivalence';

const TILE = 16;

const square = (x0: number, y0: number, x1: number, y1: number): Ring[][] => [
  [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0]
    ]
  ]
];

const region = (id: string, terrain: number, polygons: Ring[][]) => ({
  geometry: { coordinates: polygons, type: 'MultiPolygon' as const },
  properties: { id, kind: 'plain', layer: 'terrain-region', terrain },
  type: 'Feature' as const
});

// Two tiles side by side: tile 0 rates 100, tile 1 rates 50.
const world = {
  terrainByTile: [100, 50],
  tilemap: { height: 1, indices: [0, 1], width: 2 }
};

describe('compareTerrain', () => {
  test('agrees everywhere when the regions follow the tiles', () => {
    const geography: Geography = {
      bounds: [0, 0, 32, 16],
      features: [
        region('a', 100, square(0, 0, 16, 16)),
        region('b', 50, square(16, 0, 32, 16))
      ],
      type: 'FeatureCollection'
    };
    const result = compareTerrain(geography, world);
    expect(result.agreement).toBe(1);
    expect(result.mismatches).toEqual([]);
  });

  test('reports the area where a region strays onto another tile', () => {
    // Region a reaches 8 pixels into tile 1; region b keeps the rest.
    const geography: Geography = {
      bounds: [0, 0, 32, 16],
      features: [
        region('a', 100, square(0, 0, 24, 16)),
        region('b', 50, square(24, 0, 32, 16))
      ],
      type: 'FeatureCollection'
    };
    const result = compareTerrain(geography, world);
    expect(result.agreement).toBe(0.75);
    expect(result.mismatches).toEqual([
      {
        box: [16, 0, 24, 16],
        gridTerrain: 50,
        kind: 'plain',
        region: 'a',
        regionTerrain: 100,
        samples: 8
      }
    ]);
  });

  test('counts gaps and overlaps apart from disagreements', () => {
    const geography: Geography = {
      bounds: [0, 0, 32, 16],
      features: [
        region('a', 100, square(0, 0, 20, 16)),
        region('b', 50, square(16, 0, 28, 16))
      ],
      type: 'FeatureCollection'
    };
    const result = compareTerrain(geography, world);
    expect([result.overlapping, result.uncovered]).toEqual([4, 4]);
  });
});

// The traced and patched geography against the original's tile grid.
// Skips without the exported assets (`bun run extract-all`), as in CI.
test.skipIf(!hasAssets())(
  'the Terrain Regions carry the tile grid terrain everywhere',
  async () => {
    const result = await loadEquivalence();
    expect(result.mismatches.slice(0, 20)).toEqual([]);
    expect([result.uncovered, result.overlapping]).toEqual([0, 0]);
    expect(result.agreement).toBe(1);
  }
);

// The gate for the sim reading the regions (#297, ADR-0006): the grid
// the sim builds from terrain-regions.json answers as the tile grid does
// at every tile and beyond the map's edge.
test.skipIf(!hasAssets())(
  'the sim reads the tile grid terrain from the Terrain Regions',
  async () => {
    const grid = await loadTileGrid();
    const terrain = terrainGridFrom(
      loadTerrainRegions(
        await Bun.file(join(ASSETS, 'geography/terrain-regions.json')).json()
      )
    );
    const { height, width } = grid.tilemap;
    const differing: string[] = [];
    for (let y = -TILE / 2; y < height * TILE + TILE; y += TILE) {
      for (let x = -TILE / 2; x < width * TILE + TILE; x += TILE) {
        if (terrainAt({ terrain }, { x, y }) !== gridTerrainAt(grid, x, y)) {
          differing.push(`${x},${y}`);
        }
      }
    }
    expect(differing.slice(0, 20)).toEqual([]);
  }
);
