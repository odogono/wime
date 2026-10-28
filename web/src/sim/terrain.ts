// The ground movement reads: the terrain percentage of each map tile,
// taken from the vector Terrain Regions (ADR-0006, stage 2). The
// regions follow the tile grid exactly, so at load each tile takes the
// terrain of the region holding its centre, and a lookup stays a single
// array read (finding:movement-terrain-percent-scales-pace).

import { TILE_SIZE, tileOf, type Point } from './starting-state';

// A closed ring of map pixel points, first point repeated last.
export type Ring = [number, number][];

export interface TerrainRegion {
  // Polygons as an outer ring then any holes.
  polygons: Ring[][];
  terrain: number;
}

// The Terrain Regions as build-geography writes them, with the map's
// size in tiles and the terrain of ground beyond its edge, which the
// original reads as tile 0, the open sea.
export interface TerrainRegions {
  height: number;
  offMap: number;
  regions: TerrainRegion[];
  width: number;
}

// The terrain percentage of each tile in row order.
export interface TerrainGrid {
  height: number;
  offMap: number;
  values: number[];
  width: number;
}

export const pointInRing = ([x, y]: [number, number], ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const inPolygon = ([outer, ...holes]: Ring[], p: [number, number]): boolean =>
  pointInRing(p, outer!) && !holes.some(hole => pointInRing(p, hole));

// Every tile must lie in exactly one region; anything else is a broken
// geography build, refused rather than guessed at.
export const terrainGridFrom = (source: TerrainRegions): TerrainGrid => {
  const { height, width } = source;
  const values: number[] = Array.from({ length: width * height }, () => -1);
  for (const region of source.regions) {
    for (const polygon of region.polygons) {
      const xs = polygon[0]!.map(q => q[0]);
      const ys = polygon[0]!.map(q => q[1]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs) / TILE_SIZE));
      const x1 = Math.min(width - 1, Math.floor(Math.max(...xs) / TILE_SIZE));
      const y0 = Math.max(0, Math.floor(Math.min(...ys) / TILE_SIZE));
      const y1 = Math.min(height - 1, Math.floor(Math.max(...ys) / TILE_SIZE));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const centre: [number, number] = [
            tx * TILE_SIZE + TILE_SIZE / 2,
            ty * TILE_SIZE + TILE_SIZE / 2
          ];
          if (!inPolygon(polygon, centre)) {
            continue;
          }
          const i = ty * width + tx;
          if (values[i] !== -1) {
            throw new Error(`Terrain Regions overlap at tile ${tx},${ty}`);
          }
          values[i] = region.terrain;
        }
      }
    }
  }
  const gap = values.indexOf(-1);
  if (gap !== -1) {
    throw new Error(
      `No Terrain Region covers tile ${gap % width},${Math.floor(gap / width)}`
    );
  }
  return { height, offMap: source.offMap, values, width };
};

// The terrain percentage under a point. A world with no map loaded (a
// clock-only game) rates everywhere 100, so it moves at the speed-table
// pace.
export const terrainOf = (grid: TerrainGrid | null, point: Point): number => {
  if (!grid) {
    return 100;
  }
  const tile = tileOf(point);
  if (
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= grid.width ||
    tile.y >= grid.height
  ) {
    return grid.offMap;
  }
  return grid.values[tile.y * grid.width + tile.x]!;
};

const fail = (what: string): never => {
  throw new Error(`Not Terrain Regions: ${what}`);
};

const isNumber = (value: unknown): value is number => typeof value === 'number';

// Parse terrain-regions.json, as build-geography writes it.
export const loadTerrainRegions = (json: unknown): TerrainRegions => {
  const data = json as Partial<{
    height: unknown;
    off_map: unknown;
    regions: unknown;
    width: unknown;
  }> | null;
  if (
    !isNumber(data?.width) ||
    !isNumber(data.height) ||
    !isNumber(data.off_map)
  ) {
    return fail('width, height or off_map is not a number');
  }
  if (!Array.isArray(data.regions)) {
    return fail('regions is not an array');
  }
  return {
    height: data.height,
    offMap: data.off_map,
    regions: data.regions.map((region: Partial<TerrainRegion>, i) =>
      isNumber(region?.terrain) && Array.isArray(region.polygons)
        ? { polygons: region.polygons, terrain: region.terrain }
        : fail(`regions[${i}]`)
    ),
    width: data.width
  };
};

// A grid with one terrain per tile, for worlds built in tests.
export const terrainGridOf = (
  width: number,
  height: number,
  terrainAtTile: (tx: number, ty: number) => number,
  offMap = 5
): TerrainGrid =>
  terrainGridFrom({
    height,
    offMap,
    regions: Array.from({ length: width * height }, (_, i) => {
      const x = (i % width) * TILE_SIZE;
      const y = Math.floor(i / width) * TILE_SIZE;
      return {
        polygons: [
          [
            [
              [x, y],
              [x + TILE_SIZE, y],
              [x + TILE_SIZE, y + TILE_SIZE],
              [x, y + TILE_SIZE],
              [x, y]
            ]
          ]
        ],
        terrain: terrainAtTile(i % width, Math.floor(i / width))
      };
    }),
    width
  });
