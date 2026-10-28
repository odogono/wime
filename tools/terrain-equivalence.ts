#!/usr/bin/env bun
// The equivalence harness for Terrain Regions (#296, stage 2 of
// ADR-0006): samples map points and compares the terrain percentage of
// the Terrain Region under each, from the compiled source geography,
// with `terrainAt` on the tile grid, which the sim reads today. It
// changes no game behaviour.
//
//   bun run terrain-equivalence
//
// Reads web/public/assets/ (run `bun run extract-all` first) and writes
// the agreement rate and the disagreeing areas to
// web/public/assets/geography/terrain-equivalence.json, and a picture of
// them to terrain-equivalence.png: agreeing samples grey, disagreeing
// red, uncovered black and overlapping blue.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

import { terrainAt, type Tilemap } from '../web/src/sim/movement';
import {
  pointInRing,
  type Geography,
  type Point,
  type Ring
} from './build-geography';

const TILE = 16;

// Map pixels between samples. Sampling off the pixel grid's tile borders
// keeps each sample inside one tile.
export const SAMPLE_STEP = 4;

export interface Region {
  id: string;
  kind: string;
  polygons: Ring[][];
  terrain: number;
}

export type Sample =
  | { region: Region; state: 'agree' | 'disagree'; tile: number }
  | { regions: Region[]; state: 'overlap' | 'uncovered'; tile: number };

// An area of disagreeing samples: those whose tiles touch, with the same
// region and grid terrain.
export interface Mismatch {
  // The bounding box of the area's samples, in map pixels.
  box: [number, number, number, number];
  gridTerrain: number;
  kind: string;
  region: string;
  regionTerrain: number;
  samples: number;
}

export interface Equivalence {
  // Of the samples, the share whose region has the tile's terrain.
  agreement: number;
  // Samples by state, row by row, `columns` wide.
  columns: number;
  disagreeing: number;
  mismatches: Mismatch[];
  overlapping: number;
  rows: number;
  samples: number;
  states: Sample['state'][];
  step: number;
  uncovered: number;
}

export const terrainRegions = (geography: Geography): Region[] =>
  geography.features
    .filter(f => f.properties.layer === 'terrain-region')
    .map(f => ({
      id: f.properties.id,
      kind: f.properties.kind as string,
      polygons: f.geometry.coordinates as Ring[][],
      terrain: f.properties.terrain as number
    }));

const contains = (region: Region, p: Point): boolean =>
  region.polygons.some(
    ([outer, ...holes]) =>
      pointInRing(p, outer!) && !holes.some(hole => pointInRing(p, hole))
  );

// The tile holding a map coordinate, kept on the map.
const tileIn = (v: number, max: number): number =>
  Math.min(max - 1, Math.max(0, Math.floor(v / TILE)));

// The regions whose bounding boxes touch each tile, so each sample tests
// only the few regions near it.
const regionsByTile = (regions: Region[], tilemap: Tilemap): Region[][] => {
  const buckets: Region[][] = Array.from(
    { length: tilemap.width * tilemap.height },
    () => []
  );
  for (const region of regions) {
    for (const [outer] of region.polygons) {
      const xs = outer!.map(q => q[0]);
      const ys = outer!.map(q => q[1]);
      for (
        let ty = tileIn(Math.min(...ys), tilemap.height);
        ty <= tileIn(Math.max(...ys), tilemap.height);
        ty++
      ) {
        for (
          let tx = tileIn(Math.min(...xs), tilemap.width);
          tx <= tileIn(Math.max(...xs), tilemap.width);
          tx++
        ) {
          const bucket = buckets[ty * tilemap.width + tx]!;
          if (!bucket.includes(region)) {
            bucket.push(region);
          }
        }
      }
    }
  }
  return buckets;
};

export const compareTerrain = (
  geography: Geography,
  world: { terrainByTile: number[]; tilemap: Tilemap },
  step = SAMPLE_STEP
): Equivalence => {
  const { tilemap } = world;
  const buckets = regionsByTile(terrainRegions(geography), tilemap);
  const columns = Math.floor((tilemap.width * TILE) / step);
  const rows = Math.floor((tilemap.height * TILE) / step);
  const samples: Sample[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = column * step + step / 2;
      const y = row * step + step / 2;
      const tile = Math.floor(y / TILE) * tilemap.width + Math.floor(x / TILE);
      const hits = buckets[tile]!.filter(r => contains(r, [x, y]));
      if (hits.length === 1) {
        const region = hits[0]!;
        samples.push({
          region,
          state:
            region.terrain === terrainAt(world, { x, y })
              ? 'agree'
              : 'disagree',
          tile
        });
      } else {
        samples.push({
          regions: hits,
          state: hits.length ? 'overlap' : 'uncovered',
          tile
        });
      }
    }
  }
  const count = (state: Sample['state']) =>
    samples.filter(s => s.state === state).length;
  return {
    agreement: count('agree') / samples.length,
    columns,
    disagreeing: count('disagree'),
    mismatches: groupMismatches(samples, columns, step, world),
    overlapping: count('overlap'),
    rows,
    samples: samples.length,
    states: samples.map(s => s.state),
    step,
    uncovered: count('uncovered')
  };
};

// Flood the disagreeing samples into areas of neighbouring samples that
// share a region and a grid terrain, largest first.
const groupMismatches = (
  samples: Sample[],
  columns: number,
  step: number,
  world: { terrainByTile: number[]; tilemap: Tilemap }
): Mismatch[] => {
  const seen = new Uint8Array(samples.length);
  const mismatches: Mismatch[] = [];
  const rows = samples.length / columns;
  const gridTerrain = (i: number) => {
    const x = (i % columns) * step + step / 2;
    const y = Math.floor(i / columns) * step + step / 2;
    return terrainAt(world, { x, y });
  };
  for (let start = 0; start < samples.length; start++) {
    const first = samples[start]!;
    if (seen[start] || first.state !== 'disagree') {
      continue;
    }
    const terrain = gridTerrain(start);
    const stack = [start];
    seen[start] = 1;
    let n = 0;
    const box: Mismatch['box'] = [Infinity, Infinity, -Infinity, -Infinity];
    while (stack.length) {
      const i = stack.pop()!;
      const x = (i % columns) * step;
      const y = Math.floor(i / columns) * step;
      n++;
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x + step);
      box[3] = Math.max(box[3], y + step);
      const column = i % columns;
      const row = Math.floor(i / columns);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ] as const) {
        const c = column + dx;
        const r = row + dy;
        if (c < 0 || r < 0 || c >= columns || r >= rows) {
          continue;
        }
        const j = r * columns + c;
        const next = samples[j]!;
        if (
          !seen[j] &&
          next.state === 'disagree' &&
          next.region === first.region &&
          gridTerrain(j) === terrain
        ) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    mismatches.push({
      box,
      gridTerrain: terrain,
      kind: first.region.kind,
      region: first.region.id,
      regionTerrain: first.region.terrain,
      samples: n
    });
  }
  return mismatches.sort((a, b) => b.samples - a.samples);
};

const COLOURS: Record<Sample['state'], [number, number, number]> = {
  agree: [0x99, 0x99, 0x99],
  disagree: [0xff, 0x22, 0x22],
  overlap: [0x22, 0x44, 0xff],
  uncovered: [0, 0, 0]
};

// One pixel per sample.
export const picture = (result: Equivalence): Buffer => {
  const png = new PNG({ height: result.rows, width: result.columns });
  result.states.forEach((state, i) => {
    const [r, g, b] = COLOURS[state];
    png.data.set([r, g, b, 255], i * 4);
  });
  return PNG.sync.write(png);
};

export const ASSETS = join(import.meta.dir, '../web/public/assets');

export const hasAssets = (): boolean =>
  existsSync(join(ASSETS, 'geography/source.geojson')) &&
  existsSync(join(ASSETS, 'campaign/tilemap.json')) &&
  existsSync(join(ASSETS, 'starting-state.json'));

export const loadEquivalence = async (): Promise<Equivalence> => {
  const start = await Bun.file(join(ASSETS, 'starting-state.json')).json();
  return compareTerrain(
    await Bun.file(join(ASSETS, 'geography/source.geojson')).json(),
    {
      terrainByTile: start.terrain_by_tile,
      tilemap: await Bun.file(join(ASSETS, 'campaign/tilemap.json')).json()
    }
  );
};

export const main = async (): Promise<number> => {
  if (!hasAssets()) {
    console.error('terrain-equivalence: run `bun run extract-all` first');
    return 1;
  }
  const result = await loadEquivalence();
  const out = join(ASSETS, 'geography');
  const { states: _, ...report } = result;
  await Bun.write(
    join(out, 'terrain-equivalence.json'),
    JSON.stringify(report, null, 2)
  );
  await Bun.write(join(out, 'terrain-equivalence.png'), picture(result));
  console.log(
    `terrain-equivalence: ${result.samples} samples every ${result.step} px; ` +
      `agreement ${(result.agreement * 100).toFixed(2)}%, ` +
      `${result.disagreeing} disagreeing in ${result.mismatches.length} areas, ` +
      `${result.uncovered} uncovered, ${result.overlapping} overlapping`
  );
  for (const m of result.mismatches.slice(0, 20)) {
    console.log(
      `  ${m.region} (${m.kind}) at ${m.box.join(',')}: region ${m.regionTerrain}, grid ${m.gridTerrain}, ${m.samples} samples`
    );
  }
  return 0;
};

if (import.meta.main) {
  process.exit(await main());
}
