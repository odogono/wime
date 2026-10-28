import { describe, expect, test } from 'bun:test';

import type { Geography, Ring } from './build-geography';
import {
  compareTerrain,
  hasAssets,
  loadEquivalence
} from './terrain-equivalence';

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
