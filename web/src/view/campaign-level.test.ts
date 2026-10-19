import { describe, expect, test } from 'bun:test';

import type { Force, Place, PlaceKind, RosterEntry } from '../sim/index';
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
  forceAtPoint,
  hoverTargetAt,
  iconPlacements,
  iconSourceRect,
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
    // The real IMAG 100 sheet is 80 by 96 (finding:data-formats-imag-bitmaps).
    forceIcons: { height: 96, width: 80 } as HTMLCanvasElement,
    icons: [],
    startingState: null,
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

const fakeEntry = (over: Partial<RosterEntry>): RosterEntry =>
  ({
    allegiance: 99,
    icon: 0x02,
    index: 1,
    isUnit: false,
    name: 'FRODO',
    position: { x: 640, y: 368 },
    strength: 1,
    ...over
  }) as RosterEntry;

const fakeForce = (over: Partial<Force> = {}): Force => {
  const leader = over.leader ?? fakeEntry({});
  return {
    active: true,
    leader,
    members: [leader],
    onMap: true,
    position: leader.position ?? { x: 640, y: 368 },
    ...over
  };
};

describe('force icons', () => {
  test('the icon byte picks a 16x16 cell of IMAG 100 by nibbles', () => {
    // finding:graphics-campaign-icon-sheet-is-imag-100: high nibble is
    // the column, low nibble the row. Frodo is 0x02, Rohan cavalry
    // 0x20 and Mordor Orcs 0x44 (docs/spec/starting-state.md).
    expect(iconSourceRect(0x02)).toEqual({ x: 0, y: 32 });
    expect(iconSourceRect(0x20)).toEqual({ x: 32, y: 0 });
    expect(iconSourceRect(0x44)).toEqual({ x: 64, y: 64 });
  });

  test('a Force is blitted as its Leader icon at its map position', () => {
    const draws: DrawCall[] = [];
    const assets = fakeAssets(draws);
    assets.tilemap = realTilemap(Array.from({ length: 160 * 99 }, () => 0));
    const force = fakeForce();
    drawCampaignLevel(fakeContext(draws), assets, { x: 480, y: 272 }, [force]);
    // After the 21x13 tile blits: Frodo's cell at (640,368)-(480,272).
    expect(draws.at(-1)).toEqual([0, 32, 16, 16, 160, 96, 16, 16]);
  });

  test('active Forces flash off; the rest stay drawn', () => {
    const draws: DrawCall[] = [];
    const assets = fakeAssets(draws);
    assets.tilemap = realTilemap(Array.from({ length: 160 * 99 }, () => 0));
    const active = fakeForce();
    const evil = fakeForce({
      active: false,
      leader: fakeEntry({
        allegiance: 0,
        icon: 0x44,
        index: 5,
        isUnit: true,
        name: 'orcs',
        position: { x: 656, y: 368 }
      }),
      position: { x: 656, y: 368 }
    });
    drawCampaignLevel(
      fakeContext(draws),
      assets,
      { x: 480, y: 272 },
      [active, evil],
      false
    );
    // Only the Evil badge is blitted in the off half of the flash.
    expect(draws.slice(21 * 13)).toEqual([[64, 64, 16, 16, 176, 96, 16, 16]]);
  });

  test('Forces outside the viewport are not blitted', () => {
    const draws: DrawCall[] = [];
    const assets = fakeAssets(draws);
    assets.tilemap = realTilemap(Array.from({ length: 160 * 99 }, () => 0));
    drawCampaignLevel(fakeContext(draws), assets, { x: 0, y: 0 }, [
      fakeForce()
    ]);
    expect(draws).toHaveLength(21 * 13);
  });
});

describe('picking', () => {
  const forces = [
    fakeForce(),
    fakeForce({
      leader: fakeEntry({ index: 9, name: 'the NAZGUL LORD' }),
      position: { x: 640, y: 368 }
    })
  ];

  test('the last drawn Force wins where icons overlap', () => {
    expect(forceAtPoint(forces, { x: 647, y: 375 })?.leader.name).toBe(
      'the NAZGUL LORD'
    );
    expect(forceAtPoint(forces, { x: 639, y: 368 })).toBeNull();
    expect(forceAtPoint(forces, { x: 656, y: 368 })).toBeNull();
  });

  test('hover names a Force, then a named Place, then a tile kind', () => {
    const places: Place[] = [
      {
        announcesAttacks: false,
        gridByte: 50,
        gridReference: 'B3',
        index: 2,
        name: 'HOBBITON',
        position: { x: 640, y: 368 },
        tile: { x: 40, y: 23 },
        tileKind: null
      }
    ];
    const placeKinds: PlaceKind[] = [
      { index: 70, name: 'a small town', tile: 46 }
    ];
    const indices = Array.from({ length: 160 * 99 }, () => 0);
    indices[23 * 160 + 41] = 46; // the tile east of Hobbiton
    const tilemap = realTilemap(indices);

    // Frodo stands on Hobbiton's tile: the Force is named, not the Place.
    expect(
      hoverTargetAt(forces, places, placeKinds, tilemap, { x: 640, y: 368 })
        ?.name
    ).toBe('the NAZGUL LORD');
    expect(
      hoverTargetAt([], places, placeKinds, tilemap, { x: 640, y: 368 })?.name
    ).toBe('HOBBITON');
    expect(
      hoverTargetAt([], places, placeKinds, tilemap, { x: 656, y: 368 })?.name
    ).toBe('a small town');
    expect(
      hoverTargetAt([], places, placeKinds, tilemap, { x: 0, y: 0 })
    ).toBeNull();
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
