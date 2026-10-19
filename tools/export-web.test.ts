import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { DEFAULT_ARCHIVE, ExtractError, IndexedImage } from './extract-graphics';
import {
  buildTileAtlas,
  buildTilemap,
  CAMPAIGN_MAP_HEIGHT,
  CAMPAIGN_MAP_STRIDE,
  CAMPAIGN_MAP_WIDTH,
  exportWebAssets,
  paletteToJson,
  TILE_ATLAS_COLUMNS,
  type WebManifest
} from './export-web';

const solidTile = (value: number): IndexedImage => {
  const tile = new IndexedImage(16, 16);
  tile.indices.fill(value);
  return tile;
};

test('tile atlas lays tiles out in a label-free regular grid', () => {
  const atlas = buildTileAtlas([solidTile(1), solidTile(2), solidTile(3)], 2);

  expect(atlas.size).toEqual([32, 32]);
  expect(atlas.getPixel(0, 0)).toBe(1);
  expect(atlas.getPixel(16, 0)).toBe(2);
  expect(atlas.getPixel(0, 16)).toBe(3);
  expect(atlas.getPixel(16, 16)).toBe(0);
});

test('tile atlas rejects empty input', () => {
  expect(() => buildTileAtlas([])).toThrow(ExtractError);
});

test('tile map slices the width x height grid at the given stride', () => {
  // Stride wider than the map: the padding bytes (9) are dropped.
  const tilemap = buildTilemap(
    Uint8Array.from([1, 2, 9, 3, 4, 9, 5, 6]),
    2,
    2,
    3,
    16,
    16
  );

  expect(tilemap).toEqual({
    width: 2,
    height: 2,
    stride: 3,
    tile_width: 16,
    tile_height: 16,
    indices: [1, 2, 3, 4]
  });
});

test('tile map rejects short data and a stride below the width', () => {
  expect(() => buildTilemap(Uint8Array.from([1, 2, 3]), 2, 2, 2)).toThrow(
    ExtractError
  );
  expect(() =>
    buildTilemap(Uint8Array.from([1, 2, 3, 4]), 2, 2, 1)
  ).toThrow(ExtractError);
});

test('palette JSON exports RGB triples and hex for the used colours', () => {
  const palette = paletteToJson([0, 0, 0, 255, 128, 17], 2);

  expect(palette.colors).toEqual([
    [0, 0, 0],
    [255, 128, 17]
  ]);
  expect(palette.hex).toEqual(['#000000', '#ff8011']);
  expect(palette.source).toEqual({
    resource_file: 'AMaps.res',
    type: 'CHAR',
    id: 1
  });
});

// The export test reads the Reference Build, which lives in the
// gitignored artifacts/ dir and is absent in CI; it skips there.
describe.skipIf(!existsSync(DEFAULT_ARCHIVE))('web export', () => {
  const out = mkdtempSync(join(tmpdir(), 'wime-export-web-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  test('writes every web asset with a manifest entry on disk', () => {
    const manifest: WebManifest = exportWebAssets(DEFAULT_ARCHIVE, out);

    // 320 campaign tiles in a 32-column atlas (512x160), the 160x99
    // tile map, every IMAG and every CSTR (counts pinned by
    // finding:data-formats-resource-files-and-sizes).
    expect(manifest.summary).toMatchObject({
      campaign_tiles: 320,
      imag_decoded: 115,
      imag_total: 115,
      cstr_resources: 61
    });
    expect(manifest.skipped).toEqual([]);
    // Atlas, palette, tile map, atlas metadata, 115 graphics, text.
    expect(manifest.assets.length).toBe(120);
    expect(manifest.summary.assets).toBe(manifest.assets.length);

    for (const asset of manifest.assets) {
      expect(existsSync(join(out, asset.path))).toBe(true);
      if (asset.path.endsWith('.png')) {
        const png = PNG.sync.read(readFileSync(join(out, asset.path)));
        expect(asset.width).toBe(png.width);
        expect(asset.height).toBe(png.height);
        expect(asset.source).not.toBeNull();
      }
    }

    const byPath = new Map(manifest.assets.map(asset => [asset.path, asset]));

    const atlas = byPath.get('campaign/tiles.png')!;
    expect([atlas.width, atlas.height]).toEqual([
      TILE_ATLAS_COLUMNS * 16,
      Math.ceil(320 / TILE_ATLAS_COLUMNS) * 16
    ]);
    expect(atlas.source).toEqual({
      resource_file: 'AMaps.res',
      type: 'CHAR',
      id: 1
    });

    const palette = JSON.parse(
      readFileSync(join(out, 'campaign/palette.json'), 'utf8')
    ) as { colors: number[][]; hex: string[] };
    expect(palette.colors).toHaveLength(16);
    // CHAR 1 header starts 00 00 08 88 ... (RGB4 words, each nibble * 17).
    expect(palette.colors.slice(0, 2)).toEqual([
      [0, 0, 0],
      [136, 136, 136]
    ]);
    expect(palette.hex[1]).toBe('#888888');

    const tilemap = JSON.parse(
      readFileSync(join(out, 'campaign/tilemap.json'), 'utf8')
    ) as {
      width: number;
      height: number;
      stride: number;
      indices: number[];
    };
    expect(tilemap.width).toBe(CAMPAIGN_MAP_WIDTH);
    expect(tilemap.height).toBe(CAMPAIGN_MAP_HEIGHT);
    expect(tilemap.stride).toBe(CAMPAIGN_MAP_STRIDE);
    expect(tilemap.indices).toHaveLength(
      CAMPAIGN_MAP_WIDTH * CAMPAIGN_MAP_HEIGHT
    );
    expect(tilemap.indices.slice(0, 17)).toEqual(Array(17).fill(0));
    expect(Math.max(...tilemap.indices)).toBeLessThan(256);

    const text = JSON.parse(readFileSync(join(out, 'text.json'), 'utf8')) as {
      resources: { source_file: string; type: string; id: number; text: string }[];
    };
    expect(text.resources).toHaveLength(61);
    expect(
      text.resources.find(
        r => r.source_file === 'AText.res' && r.id === 57
      )!.text
    ).toContain('Three Rings for the Elven-kings');

    // A known graphics asset keeps its source resource and dimensions.
    const imag100 = byPath.get('graphics/AMaps.res/IMAG_100.png')!;
    expect([imag100.width, imag100.height]).toEqual([80, 96]);
    expect(imag100.source).toEqual({
      resource_file: 'AMaps.res',
      type: 'IMAG',
      id: 100
    });

    // The manifest on disk is the manifest that was returned.
    const onDisk = JSON.parse(
      readFileSync(join(out, 'manifest.json'), 'utf8')
    ) as WebManifest;
    expect(onDisk.summary).toEqual(manifest.summary);
    expect(onDisk.assets.map(a => a.path)).toEqual(
      manifest.assets.map(a => a.path)
    );
  });
});
