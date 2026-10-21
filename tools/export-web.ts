#!/usr/bin/env bun
// Export web-ready assets from the WHDLoad War In Middle Earth archive.
//
//   bun tools/export-web.ts [ARCHIVE] [--out DIR]
//
// ARCHIVE defaults to the Reference Build in artifacts/amiga/, found through
// the main checkout when run from a git worktree. Outputs go to
// web/public/assets/ by default (gitignored: tool output is never committed,
// see AGENTS.md). The browser only ever loads these exported PNG/JSON
// assets; it never parses Amiga formats (ADR-0001, ADR-0003).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';

import {
  exportAnimationLevel,
  readTitlePalette
} from './export-animation-level';
import {
  fontSheet,
  loadLordFont,
  parseRomTopaz,
  type DiskFont
} from './extract-font';
import {
  AmigaOFSImage,
  DEFAULT_ARCHIVE,
  ExtractError,
  IndexedImage,
  RESOURCE_FILES,
  decodeImagResource,
  loadLhaMember,
  paletteForResourceFile,
  parseResourceFork,
  safeName,
  stringifySortedJson,
  writeRgbaPng
} from './extract-graphics';
import { loadSoundFiles, readSoundTable } from './extract-sound';
import {
  STARTING_STATE_FILE,
  loadExecutable,
  parseHunkFile,
  readFullMapPalette,
  readStartingState
} from './extract-starting-state';
import {
  EXECUTABLE_FILE,
  TEXT_RESOURCE_FILES,
  decodeCstrPayload
} from './extract-text';
import { KICK13, fsUaeDir } from './fs-uae/setup';
import { loadCampaignMapAssets } from './render-campaign-map';

export const WEB_ASSETS_DIR = 'web/public/assets';

// The Campaign Level grid, solved in render-campaign-map.ts and recorded
// in finding:data-formats-campaign-map-grid.
export const CAMPAIGN_MAP_WIDTH = 160;
export const CAMPAIGN_MAP_HEIGHT = 99;
export const CAMPAIGN_MAP_STRIDE = 160;
export const TILE_ATLAS_COLUMNS = 32;

// finding:graphics-full-map-icon-imag-ids, in column order.
const FULL_MAP_ICONS = new Map([
  [32, 'eye'],
  [35, 'scroll'],
  [33, 'magnifying-glass'],
  [34, 'hourglass']
]);
const FULL_MAP_PALETTE_SOURCE =
  'Full Map Level RGB4 words at data+0x4ac8 in the executable (finding:data-formats-full-map-palette)';

const TITLE_PALETTE_SOURCE =
  'Boot sequence RGB4 words at data+0x4b88 in the executable (finding:graphics-title-screen-palette)';

const ANIMATION_PALETTE_SOURCE =
  'Animation Level RGB4 words at data+0x4b48 in the executable (finding:graphics-animation-level-palette)';

// The tiles every window's frame is built from, 16 by 8 pixels each
// (finding:ui-window-frame-tiles).
const WINDOW_FRAME_IMAG = 13;

export type AssetSource = {
  id: number | null;
  resource_file: string;
  type: string;
};

export type WebAsset = {
  count?: number;
  depth?: number;
  height: number | null;
  kind: string;
  name?: string;
  palette_source?: string;
  path: string;
  source: AssetSource | null;
  sources?: { count: number; resource_file: string; type: string }[];
  warnings?: string[];
  width: number | null;
};

export type WebManifest = {
  archive: string;
  assets: WebAsset[];
  notes: string[];
  skipped: { source: AssetSource; warnings: string[] }[];
  summary: {
    assets: number;
    campaign_tiles: number;
    cstr_resources: number;
    imag_decoded: number;
    imag_total: number;
    roster_entries: number;
    warnings: number;
  };
};

export type Tilemap = {
  height: number;
  indices: number[];
  stride: number;
  tile_height: number;
  tile_width: number;
  width: number;
};

// Lay the campaign tiles out in a regular grid with no labels or padding,
// so the web build can address tile n at
// ((n % columns) * tile_width, floor(n / columns) * tile_height).
export const buildTileAtlas = (
  tiles: IndexedImage[],
  columns: number = TILE_ATLAS_COLUMNS
): IndexedImage => {
  if (tiles.length === 0) {
    throw new ExtractError('cannot build a tile atlas with no tiles');
  }
  if (columns <= 0) {
    throw new ExtractError(`tile atlas columns must be positive: ${columns}`);
  }
  const [tileWidth, tileHeight] = tiles[0]!.size;
  const rows = Math.ceil(tiles.length / columns);
  const atlas = new IndexedImage(
    columns * tileWidth,
    rows * tileHeight,
    tiles[0]!.palette
  );
  tiles.forEach((tile, index) => {
    atlas.paste(
      tile,
      (index % columns) * tileWidth,
      Math.floor(index / columns) * tileHeight
    );
  });
  return atlas;
};

// Slice the row-major width x height grid out of the MMAP bytes. MMAP 1
// unpacks to more bytes than the grid uses (the trailing bytes are not
// explained yet, finding:data-formats-campaign-map-grid); only the grid
// is exported.
export const buildTilemap = (
  mapIndices: Uint8Array,
  width: number = CAMPAIGN_MAP_WIDTH,
  height: number = CAMPAIGN_MAP_HEIGHT,
  stride: number = CAMPAIGN_MAP_STRIDE,
  tileWidth: number = 16,
  tileHeight: number = 16
): Tilemap => {
  if (width <= 0 || height <= 0) {
    throw new ExtractError(
      `tile map dimensions must be positive: ${width}x${height}`
    );
  }
  if (stride < width) {
    throw new ExtractError(
      `tile map stride ${stride} is smaller than width ${width}`
    );
  }
  const needed = stride * (height - 1) + width;
  if (mapIndices.length < needed) {
    throw new ExtractError(
      `tile map data is short: ${mapIndices.length} bytes, expected at least ${needed}`
    );
  }
  const indices: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      indices.push(mapIndices[y * stride + x]!);
    }
  }
  return {
    height,
    indices,
    stride,
    tile_height: tileHeight,
    tile_width: tileWidth,
    width
  };
};

export type PaletteJson = {
  colors: [number, number, number][];
  hex: string[];
  palette_source: string;
  source: AssetSource | null;
  warnings?: string[];
};

// Cut a flat RGB palette down to the colours the asset actually addresses.
// The default provenance is the Campaign Level's 16 RGB4 words in CHAR 1.
export const paletteToJson = (
  palette: number[],
  colourCount: number = 16,
  provenance: Omit<PaletteJson, 'colors' | 'hex'> = {
    palette_source: 'first 16 RGB4 words in CHAR resource',
    source: { id: 1, resource_file: 'AMaps.res', type: 'CHAR' }
  }
): PaletteJson => {
  const colors: [number, number, number][] = [];
  for (let i = 0; i < colourCount; i++) {
    colors.push([
      palette[i * 3] ?? 0,
      palette[i * 3 + 1] ?? 0,
      palette[i * 3 + 2] ?? 0
    ]);
  }
  return {
    ...provenance,
    colors,
    hex: colors.map(
      ([r, g, b]) =>
        `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
    )
  };
};

export type TextRecord = {
  disk: string;
  id: number;
  length: number;
  name: string | null;
  source_file: string;
  source_member: string;
  text: string;
  type: string;
  warnings: string[];
};

export const collectCstrTexts = (archive: string): TextRecord[] => {
  const records: TextRecord[] = [];
  for (const [diskName, [memberName, resourceNames]] of Object.entries(
    TEXT_RESOURCE_FILES
  )) {
    const disk = new AmigaOFSImage(loadLhaMember(archive, memberName));
    for (const resourceName of resourceNames) {
      const fork = parseResourceFork(disk.readFile(resourceName));
      for (const resource of fork.byType('CSTR')) {
        const decoded = decodeCstrPayload(resource.data);
        records.push({
          disk: diskName,
          id: resource.resourceId,
          length: resource.data.length,
          name: resource.name,
          source_file: resourceName,
          source_member: memberName,
          text: decoded.text,
          type: resource.typeCode,
          warnings: decoded.warnings
        });
      }
    }
  }
  return records;
};

const relativePosix = (from: string, to: string): string =>
  relative(from, to).split(sep).join('/');

const writeJson = (path: string, value: unknown): void => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, stringifySortedJson(value), 'utf8');
};

// The window frame tiles carry palette indices like every IMAG, and a
// window takes the colours of the Level it opens on, so the sheet is
// exported once per Level's palette.
const exportWindowFrames = (
  data: Uint8Array,
  outputDir: string,
  levels: {
    colours: number[];
    dir: string;
    kind: string;
    paletteSource: string;
  }[]
): WebAsset[] =>
  levels.map(({ colours, dir, kind, paletteSource }) => {
    const decoded = decodeImagResource(data, colours);
    const path = join(outputDir, dir, 'window-frame.png');
    mkdirSync(join(outputDir, dir), { recursive: true });
    decoded.pixelIndices.save(path);
    return {
      depth: decoded.depth,
      height: decoded.height,
      kind,
      palette_source: paletteSource,
      path: relativePosix(outputDir, path),
      source: {
        id: WINDOW_FRAME_IMAG,
        resource_file: 'AMaps.res',
        type: 'IMAG'
      },
      width: decoded.width
    };
  });

export const exportWebAssets = (
  archive: string,
  outputDir: string
): WebManifest => {
  mkdirSync(outputDir, { recursive: true });
  const assets: WebAsset[] = [];
  const skipped: WebManifest['skipped'] = [];
  let warnings = 0;

  // Campaign Level tiles, palette and tile map (AMaps.res CHAR 1 / MMAP 1).
  const campaign = loadCampaignMapAssets(archive);
  const [tileWidth, tileHeight] = campaign.tiles[0]!.size;
  const atlas = buildTileAtlas(campaign.tiles);
  const atlasPath = join(outputDir, 'campaign', 'tiles.png');
  mkdirSync(join(outputDir, 'campaign'), { recursive: true });
  atlas.save(atlasPath);
  assets.push({
    count: campaign.tiles.length,
    height: atlas.height,
    kind: 'tile-atlas',
    palette_source: 'first 16 RGB4 words in CHAR resource',
    path: relativePosix(outputDir, atlasPath),
    source: { id: 1, resource_file: 'AMaps.res', type: 'CHAR' },
    width: atlas.width
  });

  // IMAG resources carry indices, not a palette. The Full Map Level's
  // is in the executable's data hunk (finding:data-formats-full-map-palette).
  const executable = loadExecutable(archive);
  const executableSource: AssetSource = {
    id: null,
    resource_file: EXECUTABLE_FILE,
    type: 'HUNK'
  };
  const fullMapColours = readFullMapPalette(executable);
  const fullMapPalette = paletteToJson(fullMapColours, 16, {
    palette_source: FULL_MAP_PALETTE_SOURCE,
    source: executableSource
  });
  const fullMapPalettePath = join(outputDir, 'full-map', 'palette.json');
  writeJson(fullMapPalettePath, fullMapPalette);
  assets.push({
    count: fullMapPalette.colors.length,
    height: null,
    kind: 'full-map-palette',
    palette_source: fullMapPalette.palette_source,
    path: relativePosix(outputDir, fullMapPalettePath),
    source: fullMapPalette.source,
    width: null
  });

  // The boot sequence's pictures, Credits and Ring verse are drawn in
  // the title palette (finding:graphics-title-screen-palette).
  const titleColours = readTitlePalette(executable);
  const titlePalette = paletteToJson(titleColours, 32, {
    palette_source: TITLE_PALETTE_SOURCE,
    source: executableSource
  });
  const titlePalettePath = join(outputDir, 'title', 'palette.json');
  writeJson(titlePalettePath, titlePalette);
  assets.push({
    count: titlePalette.colors.length,
    height: null,
    kind: 'title-palette',
    palette_source: titlePalette.palette_source,
    path: relativePosix(outputDir, titlePalettePath),
    source: titlePalette.source,
    width: null
  });

  const palette = paletteToJson(campaign.palette);
  const palettePath = join(outputDir, 'campaign', 'palette.json');
  writeJson(palettePath, palette);
  assets.push({
    count: palette.colors.length,
    height: null,
    kind: 'palette',
    palette_source: palette.palette_source,
    path: relativePosix(outputDir, palettePath),
    source: palette.source,
    width: null
  });

  const tilemap = buildTilemap(
    campaign.mapIndices,
    CAMPAIGN_MAP_WIDTH,
    CAMPAIGN_MAP_HEIGHT,
    CAMPAIGN_MAP_STRIDE,
    tileWidth,
    tileHeight
  );
  const tilemapPath = join(outputDir, 'campaign', 'tilemap.json');
  writeJson(tilemapPath, {
    ...tilemap,
    source: { id: 1, resource_file: 'AMaps.res', type: 'MMAP' }
  });
  assets.push({
    count: tilemap.indices.length,
    height: tilemap.height,
    kind: 'tilemap',
    path: relativePosix(outputDir, tilemapPath),
    source: { id: 1, resource_file: 'AMaps.res', type: 'MMAP' },
    width: tilemap.width
  });

  const tilesMetaPath = join(outputDir, 'campaign', 'tiles.json');
  writeJson(tilesMetaPath, {
    atlas: 'tiles.png',
    columns: TILE_ATLAS_COLUMNS,
    height: atlas.height,
    rows: Math.ceil(campaign.tiles.length / TILE_ATLAS_COLUMNS),
    source: { id: 1, resource_file: 'AMaps.res', type: 'CHAR' },
    tile_count: campaign.tiles.length,
    tile_height: tileHeight,
    tile_width: tileWidth,
    width: atlas.width
  });
  assets.push({
    count: campaign.tiles.length,
    height: atlas.height,
    kind: 'tile-atlas-metadata',
    path: relativePosix(outputDir, tilesMetaPath),
    source: { id: 1, resource_file: 'AMaps.res', type: 'CHAR' },
    width: atlas.width
  });

  // The starting state, from the executable's data hunk
  // (tools/extract-starting-state.ts, docs/spec/starting-state.md).
  const startingState = readStartingState(executable, campaign.mapIndices);
  const startingStatePath = join(outputDir, STARTING_STATE_FILE);
  writeJson(startingStatePath, startingState);
  assets.push({
    count: startingState.roster.length,
    height: null,
    kind: 'starting-state',
    path: relativePosix(outputDir, startingStatePath),
    source: executableSource,
    width: null
  });

  // The Animation Level's palette, figure sets, icons, frame and scene
  // tables (docs/spec/animation-level.md).
  const animation = exportAnimationLevel(archive, executable, outputDir);
  for (const file of animation.files) {
    const figure = animation.figures.find(
      set => `animation/${set.path}` === file.path
    );
    assets.push({
      ...(figure && { count: figure.frames.length, depth: figure.depth }),
      height: file.height,
      kind: figure ? 'animation-figures' : 'animation',
      palette_source: ANIMATION_PALETTE_SOURCE,
      path: file.path,
      source: figure
        ? { id: figure.id, resource_file: figure.resource_file, type: 'FRML' }
        : file.imag === undefined
          ? executableSource
          : { id: file.imag, resource_file: 'AMaps.res', type: 'IMAG' },
      width: file.width
    });
  }

  // Every decoded IMAG bitmap, with the Full Map Level art and icons
  // identified for the view. Keep their existing paths so source-based
  // lookups continue to work without duplicating any PNGs.
  let imagTotal = 0;
  let imagDecoded = 0;
  for (const [, [memberName, resourceNames]] of Object.entries(
    RESOURCE_FILES
  )) {
    const disk = new AmigaOFSImage(loadLhaMember(archive, memberName));
    for (const resourceName of resourceNames) {
      const fork = parseResourceFork(disk.readFile(resourceName));
      const [paletteSource, imagPalette] = paletteForResourceFile(resourceName);
      for (const resource of fork.byType('IMAG')) {
        imagTotal += 1;
        const isFullMap =
          resourceName === 'AMaps.res' && resource.resourceId === 2;
        const iconName =
          resourceName === 'AMaps.res'
            ? FULL_MAP_ICONS.get(resource.resourceId)
            : undefined;
        const isFullMapAsset = isFullMap || iconName !== undefined;
        try {
          const decoded = decodeImagResource(
            resource.data,
            isFullMapAsset ? fullMapColours : imagPalette
          );
          const path = join(
            outputDir,
            'graphics',
            safeName(resourceName),
            `IMAG_${resource.resourceId}.png`
          );
          decoded.pixelIndices.save(path);
          imagDecoded += 1;
          const assetWarnings = decoded.warnings;
          warnings += assetWarnings.length;
          const asset: WebAsset = {
            depth: decoded.depth,
            height: decoded.height,
            kind: isFullMap
              ? 'full-map'
              : iconName
                ? 'full-map-icon'
                : 'graphics',
            palette_source: isFullMapAsset
              ? FULL_MAP_PALETTE_SOURCE
              : paletteSource,
            path: relativePosix(outputDir, path),
            source: {
              id: resource.resourceId,
              resource_file: resourceName,
              type: resource.typeCode
            },
            width: decoded.width
          };
          if (iconName) {
            asset.name = iconName;
          }
          if (assetWarnings.length > 0) {
            asset.warnings = assetWarnings;
          }
          assets.push(asset);
          if (
            resourceName === 'AMaps.res' &&
            resource.resourceId === WINDOW_FRAME_IMAG
          ) {
            assets.push(
              ...exportWindowFrames(resource.data, outputDir, [
                {
                  colours: campaign.palette,
                  dir: 'campaign',
                  kind: 'window-frame',
                  paletteSource: 'first 16 RGB4 words in CHAR resource'
                },
                {
                  colours: fullMapColours,
                  dir: 'full-map',
                  kind: 'full-map-window-frame',
                  paletteSource: FULL_MAP_PALETTE_SOURCE
                },
                {
                  colours: titleColours,
                  dir: 'title',
                  kind: 'title-window-frame',
                  paletteSource: TITLE_PALETTE_SOURCE
                }
              ])
            );
          }
        } catch (error) {
          warnings += 1;
          skipped.push({
            source: {
              id: resource.resourceId,
              resource_file: resourceName,
              type: resource.typeCode
            },
            warnings: [error instanceof Error ? error.message : String(error)]
          });
        }
      }
    }
  }

  // The text fonts (finding:ui-text-font-lord-10): lord/10 from Disk 1,
  // and topaz/8 for the Full Map Level from the Kickstart 1.3 ROM the
  // game runs on, when one is at hand. Each is its strike as a white
  // glyph sheet and its tables as metrics JSON.
  const fonts: { font: DiskFont; name: string; source: AssetSource }[] = [
    {
      font: loadLordFont(archive),
      name: 'lord-10',
      source: { id: null, resource_file: 'FONTS:lord/10', type: 'font' }
    }
  ];
  const rom = join(fsUaeDir, KICK13);
  if (existsSync(rom)) {
    fonts.push({
      font: parseRomTopaz(new Uint8Array(readFileSync(rom)), KICK13),
      name: 'topaz-8',
      source: { id: null, resource_file: 'Kickstart 1.3 ROM', type: 'font' }
    });
  } else {
    warnings += 1;
    skipped.push({
      source: { id: null, resource_file: 'Kickstart 1.3 ROM', type: 'font' },
      warnings: [
        `no ${rom} (set FS_UAE_DIR): the Full Map Level falls back to the port's own topaz-style font`
      ]
    });
  }
  for (const { font, name, source } of fonts) {
    const sheetPath = join(outputDir, 'fonts', `${name}.png`);
    writeRgbaPng(sheetPath, fontSheet(font));
    const metricsPath = join(outputDir, 'fonts', `${name}.json`);
    writeJson(metricsPath, font.metrics);
    assets.push(
      {
        height: font.metrics.height,
        kind: 'font-sheet',
        name,
        path: relativePosix(outputDir, sheetPath),
        source,
        width: font.metrics.strikeWidth
      },
      {
        height: null,
        kind: 'font-metrics',
        name,
        path: relativePosix(outputDir, metricsPath),
        source,
        width: null
      }
    );
  }

  // The music and sound effects (ADR-0005): every score, instrument and
  // sample file by disk, base64-encoded, and the game's table of pieces
  // and effects (finding:sound-score-and-effect-table). The view plays
  // them with the port of the Sonix driver in web/src/audio/sonix.
  const soundFiles = loadSoundFiles(archive);
  const dataHunk = parseHunkFile(executable).find(hunk => hunk.type === 'data');
  if (!dataHunk) {
    throw new ExtractError('executable has no data hunk');
  }
  const soundPath = join(outputDir, 'audio', 'sound.json');
  writeJson(soundPath, {
    disks: Object.fromEntries(
      [...soundFiles].map(([disk, files]) => [
        disk,
        Object.fromEntries(
          [...files].map(([name, data]) => [
            name,
            Buffer.from(data).toString('base64')
          ])
        )
      ])
    ),
    table: readSoundTable(dataHunk.data)
  });
  assets.push({
    count: [...soundFiles.values()].reduce((n, files) => n + files.size, 0),
    height: null,
    kind: 'sound',
    path: relativePosix(outputDir, soundPath),
    source: null,
    width: null
  });

  // CSTR text resources as JSON.
  const texts = collectCstrTexts(archive);
  const textPath = join(outputDir, 'text.json');
  writeJson(textPath, { resources: texts });
  const textSources = Object.values(
    texts.reduce<
      Record<string, { count: number; resource_file: string; type: string }>
    >((byFile, record) => {
      const entry = (byFile[record.source_file] ??= {
        count: 0,
        resource_file: record.source_file,
        type: record.type
      });
      entry.count += 1;
      return byFile;
    }, {})
  ).sort((a, b) => (a.resource_file < b.resource_file ? -1 : 1));
  assets.push({
    count: texts.length,
    height: null,
    kind: 'text',
    path: relativePosix(outputDir, textPath),
    source: null,
    sources: textSources,
    width: null
  });

  assets.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest: WebManifest = {
    archive,
    assets,
    notes: [
      'Generated by tools/export-web.ts; do not edit or commit this directory.',
      'Campaign tiles come from AMaps.res CHAR 1 and the tile map from AMaps.res MMAP 1; only the 160x99 grid is exported, not the trailing MMAP bytes.',
      'starting-state.json holds the opening roster, Places, Forces, routes, objects and clock, read from the data hunk of the WarInMiddleEarth executable.',
      'Full Map Level art is AMaps.res IMAG 2 (640x200, 4 planes); its eye, scroll, magnifying glass and hourglass are IMAG 32, 35, 33 and 34. They are coloured with the Full Map Level palette from the executable data hunk; full-map/palette.json records its colours and provenance.',
      'animation/ holds the Animation Level: its 32-colour palette, each FRML figure set as a sheet with figures.json giving every frame and hot spot (colour variants stacked in rows selected by figures.json), the icons, the window frame (AMaps.res IMAG 12) and tables.json, the scene and script tables of the data hunk. Its scenery strips are the AScene.res and BScene.res bitmaps under graphics/.',
      'fonts/ holds the text fonts: lord/10 from Disk 1, and topaz/8 from the Kickstart 1.3 ROM when FS_UAE_DIR has one. Each .png is a strike, set bits white, and each .json its glyph locations, advances and kerning.',
      "audio/sound.json holds every .smus, .instr and .ss file of both disks, base64-encoded by disk and lower-case name, and the game's table of pieces and sound effects from the data hunk.",
      'Every decoded IMAG is exported under graphics/ with its source resource, including bitmaps whose purpose is still unidentified.'
    ],
    skipped,
    summary: {
      assets: assets.length,
      campaign_tiles: campaign.tiles.length,
      cstr_resources: texts.length,
      imag_decoded: imagDecoded,
      imag_total: imagTotal,
      roster_entries: startingState.roster.length,
      warnings
    }
  };
  writeJson(join(outputDir, 'manifest.json'), manifest);
  return manifest;
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: { out: { default: WEB_ASSETS_DIR, type: 'string' } }
  });
  const archive = positionals[0] ?? DEFAULT_ARCHIVE;
  const out = values.out ?? WEB_ASSETS_DIR;
  const manifest = exportWebAssets(archive, out);
  const summary = manifest.summary;
  console.log(
    `exported ${summary.assets} assets (${summary.campaign_tiles} campaign tiles, ` +
      `${summary.imag_decoded}/${summary.imag_total} IMAG resources, ` +
      `${summary.cstr_resources} CSTR resources; ${summary.warnings} warnings); ` +
      `manifest written to ${join(out, 'manifest.json')}`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
