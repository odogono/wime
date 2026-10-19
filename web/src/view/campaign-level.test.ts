import { describe, expect, test } from 'bun:test';

import {
  assetByKind,
  assetBySource,
  type CampaignAssets,
  type Manifest,
  type Tilemap
} from './assets';
import {
  clampCamera,
  dragCamera,
  drawCampaignLevel,
  edgeScrollDirection,
  iconPlacements,
  maxCamera,
  stepCamera
} from './campaign-level';

// The real Campaign Level dimensions (finding:data-formats-campaign-map-grid).
const realTilemap = (indices: number[] = []): Tilemap => ({
  height: 99,
  indices,
  stride: 160,
  tile_height: 16,
  tile_width: 16,
  width: 160
});

describe('camera', () => {
  test('the whole 160x99 map is reachable from the 20x12 viewport', () => {
    // Scroll limits from finding:map-campaign-viewport-20-by-12-tiles.
    expect(maxCamera(realTilemap())).toEqual({ x: 2240, y: 1392 });
  });

  test('clamps to the map edges and rounds to whole pixels', () => {
    expect(clampCamera({ x: -5, y: 99_999 }, realTilemap())).toEqual({
      x: 0,
      y: 1392
    });
    expect(clampCamera({ x: 10.6, y: 3.2 }, realTilemap())).toEqual({
      x: 11,
      y: 3
    });
  });

  test('steps by speed over time and stops at the far edge', () => {
    const tilemap = realTilemap();
    expect(
      stepCamera({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5, tilemap, 128)
    ).toEqual({ x: 64, y: 0 });
    expect(
      stepCamera({ x: 2239, y: 1391 }, { x: 1, y: 1 }, 1, tilemap, 128)
    ).toEqual({ x: 2240, y: 1392 });
    expect(
      stepCamera({ x: 5, y: 5 }, { x: -1, y: -1 }, 1, tilemap, 128)
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('drag panning', () => {
  const tilemap = realTilemap();

  test('the map follows the pointer, so the camera moves against the drag', () => {
    // Drag left and up by (32, 16): the view moves right and down.
    expect(
      dragCamera(
        { x: 100, y: 50 },
        { x: 160, y: 96 },
        { x: 128, y: 80 },
        tilemap
      )
    ).toEqual({ x: 132, y: 66 });
    // Dragging back to the start point restores the start camera.
    expect(
      dragCamera(
        { x: 100, y: 50 },
        { x: 160, y: 96 },
        { x: 160, y: 96 },
        tilemap
      )
    ).toEqual({ x: 100, y: 50 });
  });

  test('a long drag stops at the map edges', () => {
    expect(
      dragCamera({ x: 10, y: 10 }, { x: 0, y: 0 }, { x: 320, y: 192 }, tilemap)
    ).toEqual({ x: 0, y: 0 });
    expect(
      dragCamera(
        { x: 2230, y: 1380 },
        { x: 320, y: 192 },
        { x: 0, y: 0 },
        tilemap
      )
    ).toEqual({ x: 2240, y: 1392 });
  });
});

describe('edge scrolling', () => {
  const tilemap = realTilemap();

  test('no pointer, no scroll', () => {
    expect(edgeScrollDirection(null, tilemap)).toEqual({ x: 0, y: 0 });
    expect(edgeScrollDirection({ x: 160, y: 96 }, tilemap)).toEqual({
      x: 0,
      y: 0
    });
  });

  test('each edge scrolls its way, corners scroll diagonally', () => {
    expect(edgeScrollDirection({ x: 0, y: 96 }, tilemap)).toEqual({
      x: -1,
      y: 0
    });
    expect(edgeScrollDirection({ x: 319, y: 96 }, tilemap)).toEqual({
      x: 1,
      y: 0
    });
    expect(edgeScrollDirection({ x: 160, y: 0 }, tilemap)).toEqual({
      x: 0,
      y: -1
    });
    expect(edgeScrollDirection({ x: 160, y: 191 }, tilemap)).toEqual({
      x: 0,
      y: 1
    });
    expect(edgeScrollDirection({ x: 319, y: 191 }, tilemap)).toEqual({
      x: 1,
      y: 1
    });
  });
});

type DrawCall = number[];

const fakeAssets = (draws: DrawCall[]): CampaignAssets => {
  const atlas = { height: 32, width: 32 } as HTMLImageElement;
  void draws;
  return {
    atlas,
    icons: [],
    tilemap: {
      height: 2,
      indices: [0, 1, 2, 3, 3, 2],
      stride: 3,
      tile_height: 16,
      tile_width: 16,
      width: 3
    },
    tiles: {
      atlas: 'tiles.png',
      columns: 2,
      height: 32,
      rows: 2,
      tile_count: 4,
      tile_height: 16,
      tile_width: 16,
      width: 32
    }
  };
};

const fakeContext = (draws: DrawCall[]): CanvasRenderingContext2D =>
  ({
    drawImage: (...args: unknown[]) => {
      draws.push(args.slice(1).map(Number));
    },
    fillRect: () => undefined,
    fillStyle: '',
    imageSmoothingEnabled: true
  }) as unknown as CanvasRenderingContext2D;

describe('rendering', () => {
  test('blits each tile 1:1 from its atlas cell', () => {
    const draws: DrawCall[] = [];
    drawCampaignLevel(fakeContext(draws), fakeAssets(draws), { x: 0, y: 0 });

    // [sx, sy, sw, sh, dx, dy, dw, dh] per tile, row by row.
    expect(draws).toEqual([
      [0, 0, 16, 16, 0, 0, 16, 16],
      [16, 0, 16, 16, 16, 0, 16, 16],
      [0, 16, 16, 16, 32, 0, 16, 16],
      [16, 16, 16, 16, 0, 16, 16, 16],
      [16, 16, 16, 16, 16, 16, 16, 16],
      [0, 16, 16, 16, 32, 16, 16, 16]
    ]);
  });

  test('a mid-tile camera shifts every blit by the same offset', () => {
    const draws: DrawCall[] = [];
    const assets = fakeAssets(draws);
    // A map bigger than the 20x12 viewport, so the camera can sit mid-tile.
    assets.tilemap = {
      height: 14,
      indices: Array.from({ length: 25 * 14 }, (_, i) => i % 4),
      stride: 25,
      tile_height: 16,
      tile_width: 16,
      width: 25
    };
    drawCampaignLevel(fakeContext(draws), assets, { x: 24, y: 8 });

    // First visible tile is (1,0) -> index 1, drawn 8px off the left edge.
    expect(draws[0]).toEqual([16, 0, 16, 16, -8, -8, 16, 16]);
    expect(draws).toHaveLength(21 * 13);
  });

  test('icons stack right-aligned from the top right', () => {
    const image = { height: 12, width: 21 } as HTMLImageElement;
    const placements = iconPlacements([
      { image, name: 'eye' },
      { image, name: 'map' }
    ]);
    expect(placements.map(({ x, y }) => [x, y])).toEqual([
      [297, 2],
      [297, 16]
    ]);
  });
});

describe('manifest lookup', () => {
  const manifest: Manifest = {
    assets: [
      {
        height: 160,
        kind: 'tile-atlas',
        path: 'campaign/tiles.png',
        source: { id: 1, resource_file: 'AMaps.res', type: 'CHAR' },
        width: 512
      },
      {
        height: 12,
        kind: 'graphics',
        path: 'graphics/AMaps.res/IMAG_26.png',
        source: { id: 26, resource_file: 'AMaps.res', type: 'IMAG' },
        width: 21
      }
    ]
  };

  test('finds assets by kind and by source resource', () => {
    expect(assetByKind(manifest, 'tile-atlas')?.path).toBe(
      'campaign/tiles.png'
    );
    expect(assetBySource(manifest, 'AMaps.res', 'IMAG', 26)?.path).toBe(
      'graphics/AMaps.res/IMAG_26.png'
    );
  });

  test('missing assets come back undefined', () => {
    expect(assetByKind(manifest, 'text')).toBeUndefined();
    expect(assetBySource(manifest, 'AMaps.res', 'IMAG', 99)).toBeUndefined();
    expect(assetBySource(manifest, 'BScene.res', 'IMAG', 26)).toBeUndefined();
  });
});
