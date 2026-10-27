import { describe, expect, test } from 'bun:test';

import {
  bandAt,
  clusterDots,
  placeLabels,
  rankZoom,
  spriteScale,
  tierFor,
  zoomRange
} from './lod';

const range = zoomRange(
  { height: 900, width: 1440 },
  { height: 1584, width: 2560 }
);

describe('zoomRange', () => {
  test('fits the map at the minimum and puts the band boundary between', () => {
    expect(range.min).toBe(Math.min(1440 / 2560, 900 / 1584));
    expect(range.campaign).toBe(1440 / 320);
    expect(range.max).toBe(range.campaign * 4);
    expect(range.boundary).toBeGreaterThan(range.min);
    expect(range.boundary).toBeLessThan(range.campaign);
  });
});

describe('bandAt', () => {
  test('holds the current band just past the boundary', () => {
    const justBelow = range.boundary * 0.97;
    expect(bandAt(justBelow, range)).toBe('full-map');
    expect(bandAt(justBelow, range, 'campaign')).toBe('campaign');
    expect(bandAt(range.boundary * 1.03, range, 'full-map')).toBe('full-map');
  });
});

describe('tierFor', () => {
  test('goes from figure to compact to dot as the map zooms out', () => {
    expect(tierFor(range.campaign, range, false)).toBe('figure');
    expect(tierFor(range.boundary * 1.1, range, false)).toBe('compact');
    expect(tierFor(range.min, range, false)).toBe('dot');
  });

  test('draws an important Force one tier more detailed', () => {
    expect(tierFor(range.min, range, true)).toBe('compact');
    expect(tierFor(range.boundary * 1.1, range, true)).toBe('figure');
    expect(tierFor(range.campaign, range, true)).toBe('figure');
  });

  test('keeps the previous tier just past a threshold', () => {
    const justBelow = range.boundary * 0.97;
    expect(tierFor(justBelow, range, false)).toBe('dot');
    expect(tierFor(justBelow, range, false, 'compact')).toBe('compact');
    expect(tierFor(range.boundary * 1.03, range, false, 'dot')).toBe('dot');
  });
});

describe('spriteScale', () => {
  test('holds sprites between one and three times their pixel size', () => {
    expect(spriteScale(0.2, 1)).toBe(1);
    expect(spriteScale(2.4, 1)).toBe(2);
    expect(spriteScale(12, 1)).toBe(3);
    expect(spriteScale(12, 2)).toBe(6);
  });
});

describe('clusterDots', () => {
  test('merges dots that crowd each other and keeps lone dots apart', () => {
    const clusters = clusterDots(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 4, y: 0 },
        { id: 3, x: 100, y: 0 }
      ],
      8
    );
    expect(clusters.map(c => c.ids)).toEqual([[1, 2], [3]]);
    expect(clusters[0]!.x).toBe(2);
  });
});

describe('rankZoom', () => {
  test('shows rank 0 always and finer ranks closer in', () => {
    expect(rankZoom(0, range)).toBe(0);
    expect(rankZoom(1, range)).toBe(range.boundary);
    expect(rankZoom(2, range)).toBeGreaterThanOrEqual(range.boundary);
  });
});

const box = (x: number) => ({ box: { height: 10, width: 40, x, y: 0 } });

describe('placeLabels', () => {
  test('moves a label to its first free alternative', () => {
    const obstacle = { height: 10, width: 40, x: 0, y: 0 };
    const label = {
      alternatives: [{ height: 10, width: 40, x: 0, y: 30 }],
      box: { height: 10, width: 40, x: 0, y: 0 }
    };
    expect(placeLabels([label], [obstacle])[0]!.box.y).toBe(30);
  });

  test('keeps a label that must show when nowhere is free', () => {
    const obstacle = { height: 10, width: 40, x: 0, y: 0 };
    const box = { height: 10, width: 40, x: 0, y: 0 };
    expect(placeLabels([{ box }], [obstacle])).toEqual([]);
    expect(placeLabels([{ box, keep: true }], [obstacle])).toHaveLength(1);
  });

  test('drops a later label that would overlap an earlier one', () => {
    expect(placeLabels([box(0), box(20), box(100)]).map(l => l.box.x)).toEqual([
      0, 100
    ]);
  });
});
