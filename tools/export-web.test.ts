import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'bun:test';
import { PNG } from 'pngjs';

import {
  buildFigureSheet,
  figureColour,
  type AnimationTables,
  type FigureSet
} from './export-animation-level';
import {
  CAMPAIGN_MAP_HEIGHT,
  CAMPAIGN_MAP_STRIDE,
  CAMPAIGN_MAP_WIDTH,
  TILE_ATLAS_COLUMNS,
  buildTileAtlas,
  buildTilemap,
  exportWebAssets,
  paletteToJson,
  type PaletteJson,
  type WebManifest
} from './export-web';
import {
  DEFAULT_ARCHIVE,
  ExtractError,
  IndexedImage,
  titlePalette
} from './extract-graphics';
import { KICK13, fsUaeDir } from './fs-uae/setup';

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
    height: 2,
    indices: [1, 2, 3, 4],
    stride: 3,
    tile_height: 16,
    tile_width: 16,
    width: 2
  });
});

test('tile map rejects short data and a stride below the width', () => {
  expect(() => buildTilemap(Uint8Array.from([1, 2, 3]), 2, 2, 2)).toThrow(
    ExtractError
  );
  expect(() => buildTilemap(Uint8Array.from([1, 2, 3, 4]), 2, 2, 1)).toThrow(
    ExtractError
  );
});

test('palette JSON exports RGB triples and hex for the used colours', () => {
  const palette = paletteToJson([0, 0, 0, 255, 128, 17], 2);

  expect(palette.colors).toEqual([
    [0, 0, 0],
    [255, 128, 17]
  ]);
  expect(palette.hex).toEqual(['#000000', '#ff8011']);
  expect(palette.source).toEqual({
    id: 1,
    resource_file: 'AMaps.res',
    type: 'CHAR'
  });
});

test('a provisional palette retains tool provenance without claiming a resource source', () => {
  const palette = paletteToJson([255, 238, 170], 1, {
    palette_source: 'Provisional hand-entered full-map palette',
    source: null,
    warnings: ['Colours are provisional.']
  });

  expect(palette).toEqual({
    colors: [[255, 238, 170]],
    hex: ['#ffeeaa'],
    palette_source: 'Provisional hand-entered full-map palette',
    source: null,
    warnings: ['Colours are provisional.']
  });
});

const solidFrame = (width: number, value: number) => {
  const image = new IndexedImage(width, 2);
  image.indices.fill(value);
  image.setPixel(0, 0, 0);
  return image;
};

test('a figure sheet lays frames side by side, 4-plane sets in colours 16 to 31', () => {
  const frames = [
    { hotX: 1, hotY: 2, image: solidFrame(3, 5) },
    { hotX: 0, hotY: 1, image: solidFrame(2, 1) }
  ];
  const { frames: placed, sheet } = buildFigureSheet(frames, 4, []);

  expect(sheet.size).toEqual([5, 2]);
  expect(placed).toEqual([
    { height: 2, hot_x: 1, hot_y: 2, width: 3, x: 0 },
    { height: 2, hot_x: 0, hot_y: 1, width: 2, x: 3 }
  ]);
  // Colour 0 stays clear; the rest move up by 16.
  expect([
    sheet.getPixel(0, 0),
    sheet.getPixel(1, 0),
    sheet.getPixel(4, 1)
  ]).toEqual([0, 21, 17]);
  expect(buildFigureSheet(frames, 5, []).sheet.getPixel(1, 0)).toBe(5);
});

// Selector words traced in finding:graphics-figure-colour-selectors.
// These are complete colour ramps, independent of the plane-routing code.
const ramp = (word: number) =>
  Array.from({ length: 16 }, (_, i) => figureColour(i, word));

test('figure colour selectors reproduce the wizard and the two winning men', () => {
  expect(ramp(0x56_88)).toEqual([
    0, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
  ]);
  expect(ramp(0x3a_50)).toEqual([
    0, 9, 12, 13, 10, 11, 14, 15, 24, 25, 28, 29, 26, 27, 30, 31
  ]);
  expect(ramp(0x2a_58)).toEqual([
    0, 9, 12, 13, 24, 25, 28, 29, 10, 11, 14, 15, 26, 27, 30, 31
  ]);
  expect(ramp(0x14_e8)).toEqual([
    0, 3, 18, 19, 10, 11, 26, 27, 6, 7, 22, 23, 14, 15, 30, 31
  ]);
});

test('a figure sheet keeps transparent pixels and stacks each colour variant below the frames', () => {
  const image = new IndexedImage(16, 1);
  image.indices.set(Array.from({ length: 16 }, (_, i) => i));
  const { colour_rows, sheet } = buildFigureSheet(
    [{ hotX: 0, hotY: 0, image }],
    4,
    [],
    new Map([
      [6, 0x3a_50],
      [14, 0x2a_58],
      [24, 0x14_e8]
    ])
  );
  expect(colour_rows).toEqual({ 0: 0, 14: 2, 24: 3, 6: 1 });
  expect(sheet.size).toEqual([16, 4]);
  expect([
    sheet.getPixel(0, 1),
    sheet.getPixel(0, 2),
    sheet.getPixel(0, 3)
  ]).toEqual([0, 0, 0]);
  expect([
    sheet.getPixel(6, 1),
    sheet.getPixel(6, 2),
    sheet.getPixel(6, 3)
  ]).toEqual([14, 28, 26]);
});

// The export test reads the Reference Build, which lives in the
// gitignored artifacts/ dir and is absent in CI; it skips there.
describe.skipIf(!existsSync(DEFAULT_ARCHIVE))('web export', () => {
  const out = mkdtempSync(join(tmpdir(), 'wime-export-web-'));
  afterAll(() => rmSync(out, { force: true, recursive: true }));

  test('writes every web asset with a manifest entry on disk', () => {
    const manifest: WebManifest = exportWebAssets(DEFAULT_ARCHIVE, out);

    // 320 campaign tiles in a 32-column atlas (512x160), the 160x99
    // tile map, every IMAG and every CSTR (counts pinned by
    // finding:data-formats-resource-files-and-sizes).
    expect(manifest.summary).toMatchObject({
      campaign_tiles: 320,
      cstr_resources: 61,
      imag_decoded: 115,
      imag_total: 115,
      roster_entries: 196
    });
    // Only a missing Kickstart ROM is skipped, for topaz/8.
    expect(
      manifest.skipped.filter(entry => entry.source.type !== 'font')
    ).toEqual([]);
    // Atlas, palette, tile map, atlas metadata, 115 graphics, text and
    // the starting state, plus the Full Map Level palette and the window
    // frame tiles in each Level's palette, and the Animation Level's
    // palette, tables, figure index, 3 icons, frame and 19 figure sets,
    // and a glyph sheet and metrics for lord/10, and for topaz/8 when
    // there is a Kickstart 1.3 ROM, the sound files, and the title
    // palette and its window frame.
    const topaz = existsSync(join(fsUaeDir, KICK13)) ? 2 : 0;
    expect(manifest.assets.length).toBe(124 + 26 + 2 + topaz + 1 + 2);
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

    const fullMap = byPath.get('graphics/AMaps.res/IMAG_2.png')!;
    expect(fullMap).toMatchObject({
      depth: 4,
      height: 200,
      kind: 'full-map',
      source: { id: 2, resource_file: 'AMaps.res', type: 'IMAG' },
      width: 640
    });
    expect(fullMap.palette_source).toContain('data+0x4ac8');
    expect(fullMap.warnings).toBeUndefined();

    const fullMapPaletteAsset = byPath.get('full-map/palette.json')!;
    expect(fullMapPaletteAsset.kind).toBe('full-map-palette');
    // The colours come from the executable's data hunk, not IMAG or CHAR
    // (finding:data-formats-full-map-palette).
    expect(fullMapPaletteAsset.source).toEqual({
      id: null,
      resource_file: 'WarInMiddleEarth',
      type: 'HUNK'
    });
    const fullMapPalette = JSON.parse(
      readFileSync(join(out, fullMapPaletteAsset.path), 'utf8')
    ) as PaletteJson;
    expect(fullMapPalette.source).toEqual(fullMapPaletteAsset.source);
    expect(fullMap.palette_source).toBe(fullMapPalette.palette_source);
    expect(fullMapPalette.warnings).toBeUndefined();
    expect(fullMapPalette.colors).toHaveLength(16);
    // Red, green, cyan and cream: the dot colours 10, 14, 12 and 15
    // (finding:ui-full-map-dot-colours).
    expect(fullMapPalette.hex[10]).toBe('#ff0000');
    expect(fullMapPalette.hex[14]).toBe('#22ff33');
    expect(fullMapPalette.hex[12]).toBe('#00ffff');
    expect(fullMapPalette.hex[15]).toBe('#ffeebb');

    // PNG pixels must use the exported palette: every colour but 13,
    // magenta, which the map art never uses.
    const mapPng = PNG.sync.read(readFileSync(join(out, fullMap.path)));
    const colours = new Set<string>();
    for (let i = 0; i < mapPng.data.length; i += 4) {
      colours.add([...mapPng.data.subarray(i, i + 3)].join(','));
    }
    expect(colours).toEqual(
      new Set(
        fullMapPalette.colors
          .filter((_, index) => index !== 13)
          .map(rgb => rgb.join(','))
      )
    );

    const fullMapIcons = manifest.assets.filter(
      asset => asset.kind === 'full-map-icon'
    );
    expect(fullMapIcons).toHaveLength(4);
    expect(
      fullMapIcons.map(asset => [
        asset.name,
        asset.source,
        asset.width,
        asset.height
      ])
    ).toEqual([
      ['eye', { id: 32, resource_file: 'AMaps.res', type: 'IMAG' }, 40, 10],
      [
        'magnifying-glass',
        { id: 33, resource_file: 'AMaps.res', type: 'IMAG' },
        31,
        15
      ],
      [
        'hourglass',
        { id: 34, resource_file: 'AMaps.res', type: 'IMAG' },
        22,
        14
      ],
      ['scroll', { id: 35, resource_file: 'AMaps.res', type: 'IMAG' }, 35, 16]
    ]);
    for (const icon of fullMapIcons) {
      expect(icon.palette_source).toBe(fullMap.palette_source);
      expect(icon.warnings).toBeUndefined();
    }

    // AMaps.res IMAG 13, twelve 16 by 8 frame tiles
    // (finding:ui-window-frame-tiles), in each Level's palette.
    for (const kind of ['window-frame', 'full-map-window-frame']) {
      const frame = manifest.assets.find(asset => asset.kind === kind)!;
      expect(frame.source).toEqual({
        id: 13,
        resource_file: 'AMaps.res',
        type: 'IMAG'
      });
      expect([frame.width, frame.height, frame.depth]).toEqual([16, 96, 4]);
    }

    // The Animation Level (docs/spec/animation-level.md).
    const figureSets = manifest.assets.filter(
      asset => asset.kind === 'animation-figures'
    );
    expect(figureSets).toHaveLength(19);
    const animationPalette = JSON.parse(
      readFileSync(join(out, 'animation/palette.json'), 'utf8')
    ) as { hex: string[] };
    expect(animationPalette.hex).toHaveLength(32);
    expect(animationPalette.hex.slice(0, 3)).toEqual([
      '#000000',
      '#ddccaa',
      '#22aaee'
    ]);
    // The boot sequence's palette (finding:graphics-title-screen-palette),
    // which the ATitle.res pictures are decoded in too.
    const titlePaletteJson = JSON.parse(
      readFileSync(join(out, 'title/palette.json'), 'utf8')
    ) as { colors: number[][]; hex: string[] };
    expect(titlePaletteJson.hex.slice(0, 6)).toEqual([
      '#000000',
      '#ffffdd',
      '#110000',
      '#111111',
      '#bb0000',
      '#884422'
    ]);
    expect(titlePaletteJson.colors.flat()).toEqual(titlePalette().slice(0, 96));
    expect(byPath.get('graphics/ATitle.res/IMAG_72.png')!.palette_source).toBe(
      'War In Middle Earth title palette'
    );
    expect(byPath.get('title/window-frame.png')!.kind).toBe(
      'title-window-frame'
    );
    const tables = JSON.parse(
      readFileSync(join(out, 'animation/tables.json'), 'utf8')
    ) as AnimationTables;
    expect(tables.scene_words).toHaveLength(256);
    expect(tables.scenery_lists).toHaveLength(18);
    expect(tables.scenery_lists[0]).toEqual([
      { choices: [-9045], optional: false, parallax: 75 },
      { choices: [-3059], optional: false, parallax: 75 }
    ]);
    expect(tables.foreground_lists[0]).toHaveLength(15);
    expect(tables.sky_colours).toEqual([
      4, 4, 10, 11, 12, 12, 12, 12, 11, 10, 4, 4
    ]);
    expect(tables.sky_colours_dark).toEqual([16, 4, 5, 5, 4, 16]);
    expect(tables.figure_colours).toHaveLength(196);
    // Gandalf, Aragorn and Boromir on the Animation Level.
    expect([1, 5, 6].map(i => tables.figure_colours[i])).toEqual([4, 14, 24]);
    expect(tables.figure_scripts).toHaveLength(20);
    expect(tables.figure_scripts[0]).toHaveLength(0xfc);
    const figures = JSON.parse(
      readFileSync(join(out, 'animation/figures.json'), 'utf8')
    ) as { figures: FigureSet[] };
    for (const [id, selectors] of [
      [4, [4, 6]],
      [2, [14, 24]],
      [8, [1]]
    ] as const) {
      const set = figures.figures.find(set => set.id === id)!;
      expect(selectors.every(selector => set.colour_rows[selector]! > 0)).toBe(
        true
      );
    }
    const ent = figures.figures.find(set => set.id === 7)!;
    expect([ent.resource_file, ent.depth, ent.frames.length]).toEqual([
      'AAnims.res',
      5,
      10
    ]);
    expect(ent.frames[0]).toMatchObject({ height: 87, width: 56, x: 0 });

    const atlas = byPath.get('campaign/tiles.png')!;
    expect([atlas.width, atlas.height]).toEqual([
      TILE_ATLAS_COLUMNS * 16,
      Math.ceil(320 / TILE_ATLAS_COLUMNS) * 16
    ]);
    expect(atlas.source).toEqual({
      id: 1,
      resource_file: 'AMaps.res',
      type: 'CHAR'
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
      height: number;
      indices: number[];
      stride: number;
      width: number;
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
      resources: {
        id: number;
        source_file: string;
        text: string;
        type: string;
      }[];
    };
    expect(text.resources).toHaveLength(61);
    expect(
      text.resources.find(r => r.source_file === 'AText.res' && r.id === 57)!
        .text
    ).toContain('Three Rings for the Elven-kings');

    // A known graphics asset keeps its source resource and dimensions.
    const imag100 = byPath.get('graphics/AMaps.res/IMAG_100.png')!;
    expect([imag100.width, imag100.height]).toEqual([80, 96]);
    expect(imag100.source).toEqual({
      id: 100,
      resource_file: 'AMaps.res',
      type: 'IMAG'
    });

    expect(byPath.get('starting-state.json')!.source).toEqual({
      id: null,
      resource_file: 'WarInMiddleEarth',
      type: 'HUNK'
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
