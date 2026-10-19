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
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';

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
  stringifySortedJson
} from './extract-graphics';
import { TEXT_RESOURCE_FILES, decodeCstrPayload } from './extract-text';
import { loadCampaignMapAssets } from './render-campaign-map';

export const WEB_ASSETS_DIR = 'web/public/assets';

// The Campaign Level grid, solved in render-campaign-map.ts and recorded
// in finding:data-formats-campaign-map-grid.
export const CAMPAIGN_MAP_WIDTH = 160;
export const CAMPAIGN_MAP_HEIGHT = 99;
export const CAMPAIGN_MAP_STRIDE = 160;
export const TILE_ATLAS_COLUMNS = 32;

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
  source: AssetSource;
};

// The flat 256-entry RGB palette the tools use, cut down to the colours
// the campaign tiles actually address (16 RGB4 words in CHAR 1).
export const paletteToJson = (
  palette: number[],
  colourCount: number = 16
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
    colors,
    hex: colors.map(
      ([r, g, b]) =>
        `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
    ),
    palette_source: 'first 16 RGB4 words in CHAR resource',
    source: { id: 1, resource_file: 'AMaps.res', type: 'CHAR' }
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

  // Every decoded IMAG bitmap. No Finding identifies individual IMAG
  // resources as the icon column, a UI window or the font yet, so all of
  // them are exported and the manifest records each source resource; the
  // web build picks the ones it needs as they get identified.
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
        try {
          const decoded = decodeImagResource(resource.data, imagPalette);
          const path = join(
            outputDir,
            'graphics',
            safeName(resourceName),
            `IMAG_${resource.resourceId}.png`
          );
          decoded.pixelIndices.save(path);
          imagDecoded += 1;
          warnings += decoded.warnings.length;
          const asset: WebAsset = {
            depth: decoded.depth,
            height: decoded.height,
            kind: 'graphics',
            palette_source: paletteSource,
            path: relativePosix(outputDir, path),
            source: {
              id: resource.resourceId,
              resource_file: resourceName,
              type: resource.typeCode
            },
            width: decoded.width
          };
          if (decoded.warnings.length > 0) {
            asset.warnings = decoded.warnings;
          }
          assets.push(asset);
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
      'No Finding identifies individual IMAG resources as the icon column, UI windows or the font yet, so every decoded IMAG is exported under graphics/ with its source resource.'
    ],
    skipped,
    summary: {
      assets: assets.length,
      campaign_tiles: campaign.tiles.length,
      cstr_resources: texts.length,
      imag_decoded: imagDecoded,
      imag_total: imagTotal,
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
