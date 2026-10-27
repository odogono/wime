import { describe, expect, test } from 'bun:test';

import {
  applyPatches,
  assembleRegions,
  components,
  followSkeleton,
  signedArea,
  smooth,
  thin,
  traceArcs,
  type Geography,
  type Ring
} from './build-geography';

// A 5 by 3 grid: a 2 by 1 island of label 1 inside label 0, and a column
// of label 2 down the right edge.
const W = 5;
const H = 3;
const labels = Int32Array.from([0, 0, 0, 0, 2, 0, 1, 1, 0, 2, 0, 0, 0, 0, 2]);

const area = (polygons: Ring[][]): number =>
  polygons.reduce(
    (sum, [outer, ...holes]) =>
      sum +
      Math.abs(signedArea(outer!)) -
      holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0),
    0
  );

describe('traceArcs and assembleRegions', () => {
  const c = components(labels, W, H);
  const arcs = traceArcs(c.component, W, H);

  test('each region covers exactly its cells, holes included', () => {
    const regions = assembleRegions(arcs, c.first, c.label, p => p);
    expect(regions.map(r => [r.label, area(r.polygons)])).toEqual([
      [0, 10],
      [2, 3],
      [1, 2]
    ]);
    expect(regions[0]!.polygons[0]).toHaveLength(2);
  });

  test('smoothing a shared border keeps the regions tiling the map', () => {
    const regions = assembleRegions(arcs, c.first, c.label, (p, edge) =>
      edge ? p : smooth(p, 3)
    );
    expect(regions.reduce((sum, r) => sum + area(r.polygons), 0)).toBeCloseTo(
      W * H
    );
  });
});

const point = (id: string, x: number) => ({
  geometry: {
    coordinates: [x, 0] as [number, number],
    type: 'Point' as const
  },
  properties: { id, layer: 'place' },
  type: 'Feature' as const
});

describe('applyPatches', () => {
  const geography: Geography = {
    bounds: [0, 0, 10, 10],
    features: [point('a', 1), point('b', 2)],
    type: 'FeatureCollection'
  };

  test('replaces, adds and deletes whole features by id', () => {
    const patched = applyPatches(geography, [
      {
        features: [
          {
            ...point('a', 5),
            properties: { id: 'a', layer: 'place', op: 'replace' }
          },
          {
            ...point('b', 0),
            properties: { id: 'b', layer: 'place', op: 'delete' }
          },
          {
            ...point('c', 7),
            properties: { id: 'c', layer: 'place', op: 'add' }
          }
        ]
      }
    ]);
    expect(
      patched.features.map(f => [f.properties.id, f.geometry.coordinates])
    ).toEqual([
      ['a', [5, 0]],
      ['c', [7, 0]]
    ]);
  });

  test('rejects a patch for a feature that was never traced', () => {
    expect(() =>
      applyPatches(geography, [
        {
          features: [
            {
              ...point('z', 0),
              properties: { id: 'z', layer: 'place', op: 'delete' }
            }
          ]
        }
      ])
    ).toThrow('unknown z');
  });
});

describe('thin and followSkeleton', () => {
  test('thin a thick bar to one line and follow it end to end', () => {
    const width = 12;
    const height = 5;
    const mask = new Uint8Array(width * height);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 10; x++) {
        mask[y * width + x] = 1;
      }
    }
    thin(mask, width, height);
    const lines = followSkeleton(mask, width, height);
    expect(lines).toHaveLength(1);
    const ys = new Set(lines[0]!.map(([, y]) => y));
    expect(ys.size).toBe(1);
    expect(lines[0]!.length).toBeGreaterThanOrEqual(6);
  });
});
