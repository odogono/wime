#!/usr/bin/env bun
// Render the base campaign map from AMaps.res.
//
//   bun tools/render-campaign-map.ts [ARCHIVE] [--out DIR]
//
// ARCHIVE defaults to the Reference Build in artifacts/amiga/. Outputs go
// to extracted_graphics/campaign_map/ by default.
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  AmigaOFSImage,
  DEFAULT_ARCHIVE,
  IndexedImage,
  beU16,
  beU32,
  loadLhaMember,
  makeRgbaImage,
  parseResourceFork,
  pasteRgba,
  stringifySortedJson,
  unpackPackbits,
  writeRgbaPng
} from './extract-graphics';
import { drawSheetLabel, type RgbaImage } from './sheet-font';

export type CampaignMapAssets = {
  charHeader: Uint8Array;
  mapIndices: Uint8Array;
  palette: number[];
  tiles: IndexedImage[];
};

export const loadCampaignMapAssets = (archive: string): CampaignMapAssets => {
  const disk = new AmigaOFSImage(
    loadLhaMember(archive, 'WarInMiddleEarth/data/Disk.1')
  );
  const resources = parseResourceFork(disk.readFile('AMaps.res'));
  const charResource = resources.get('CHAR', 1).data;
  const mmapResource = resources.get('MMAP', 1).data;

  const [charData] = unpackPackbits(
    charResource.subarray(4),
    beU32(charResource, 0)
  );
  const [mapIndices] = unpackPackbits(
    mmapResource.subarray(4),
    beU32(mmapResource, 0)
  );

  return {
    charHeader: charData.subarray(0, 32),
    mapIndices,
    palette: paletteFromRgb4Words(charData.subarray(0, 32)),
    tiles: decodeCampaignTiles(charData)
  };
};

export const paletteFromRgb4Words = (data: Uint8Array): number[] => {
  const palette: number[] = [];
  for (let offset = 0; offset < Math.min(data.length, 32); offset += 2) {
    const value = beU16(data, offset);
    palette.push(
      ((value >> 8) & 0xf) * 17,
      ((value >> 4) & 0xf) * 17,
      (value & 0xf) * 17
    );
  }
  while (palette.length < 256 * 3) {
    palette.push(0, 0, 0);
  }
  return palette;
};

export const decodeCampaignTiles = (charData: Uint8Array): IndexedImage[] => {
  const headerSize = 32;
  const tileWidth = 16;
  const tileHeight = 16;
  const depth = 4;
  const rowBytes = 2;
  const tileSize = tileHeight * depth * rowBytes;
  const palette = paletteFromRgb4Words(charData.subarray(0, headerSize));
  const tiles: IndexedImage[] = [];

  for (
    let offset = headerSize;
    offset <= charData.length - tileSize;
    offset += tileSize
  ) {
    const tileData = charData.subarray(offset, offset + tileSize);
    const tile = new IndexedImage(tileWidth, tileHeight, palette);
    for (let y = 0; y < tileHeight; y++) {
      for (let x = 0; x < tileWidth; x++) {
        let value = 0;
        for (let plane = 0; plane < depth; plane++) {
          const byteOffset =
            y * depth * rowBytes + plane * rowBytes + Math.floor(x / 8);
          if ((tileData[byteOffset]! & (0x80 >> (x % 8))) !== 0) {
            value |= 1 << plane;
          }
        }
        tile.setPixel(x, y, value);
      }
    }
    tiles.push(tile);
  }

  return tiles;
};

export const renderTileSheet = (
  tiles: IndexedImage[],
  columns: number = 20
): RgbaImage => {
  const [tileWidth, tileHeight] = tiles[0]!.size;
  const labelHeight = 10;
  const rows = Math.floor((tiles.length + columns - 1) / columns);
  const sheet = makeRgbaImage(
    columns * tileWidth,
    rows * (tileHeight + labelHeight),
    [24, 24, 24]
  );
  tiles.forEach((tile, index) => {
    const x = (index % columns) * tileWidth;
    const y = Math.floor(index / columns) * (tileHeight + labelHeight);
    pasteRgba(sheet, tile.toRgba(), x, y);
    drawSheetLabel(
      sheet,
      x + 1,
      y + tileHeight,
      String(index),
      [230, 230, 230]
    );
  });
  return sheet;
};

export const renderRawMap = (
  tiles: IndexedImage[],
  mapIndices: Uint8Array,
  palette: number[],
  widthTiles: number,
  heightTiles: number,
  strideTiles: number,
  offset: number = 0
): IndexedImage => {
  const [tileWidth, tileHeight] = tiles[0]!.size;
  const output = new IndexedImage(
    widthTiles * tileWidth,
    heightTiles * tileHeight,
    palette
  );

  for (let y = 0; y < heightTiles; y++) {
    for (let x = 0; x < widthTiles; x++) {
      const position = offset + y * strideTiles + x;
      if (position >= mapIndices.length) {
        continue;
      }
      const tileIndex = mapIndices[position]!;
      if (tileIndex < tiles.length) {
        output.paste(tiles[tileIndex]!, x * tileWidth, y * tileHeight);
      }
    }
  }

  return output;
};

export type CampaignManifest = {
  archive: string;
  char: {
    decompressed_size: number;
    depth: number;
    header_hex: string;
    palette_source: string;
    tile_count: number;
    tile_size: number[];
  };
  mmap: {
    decompressed_size: number;
    layout_status: string;
    map_grid_tiles: number[];
    map_size_pixels: number[];
    scroll_limits_pixels: number[];
    viewport_size_pixels: number[];
  };
  outputs: {
    base_map: string;
    tile_sheet: string;
    top_left_view: string;
  };
  source: string;
};

const spacedHex = (data: Uint8Array): string =>
  [...data].map(byte => byte.toString(16).padStart(2, '0')).join(' ');

export const renderCampaignOutputs = (
  archive: string,
  outputDir: string
): CampaignManifest => {
  mkdirSync(outputDir, { recursive: true });
  const assets = loadCampaignMapAssets(archive);

  const tileSheetPath = join(outputDir, 'campaign_tiles.png');
  const baseMapPath = join(outputDir, 'campaign_base_map_160x99.png');
  const topLeftViewPath = join(outputDir, 'campaign_top_left_view_20x12.png');
  const manifestPath = join(outputDir, 'campaign_map_manifest.json');

  writeRgbaPng(tileSheetPath, renderTileSheet(assets.tiles));
  renderRawMap(
    assets.tiles,
    assets.mapIndices,
    assets.palette,
    160,
    99,
    160
  ).save(baseMapPath);
  renderRawMap(
    assets.tiles,
    assets.mapIndices,
    assets.palette,
    20,
    12,
    160
  ).save(topLeftViewPath);

  const manifest: CampaignManifest = {
    archive,
    char: {
      decompressed_size: assets.charHeader.length + assets.tiles.length * 128,
      depth: 4,
      header_hex: spacedHex(assets.charHeader),
      palette_source: 'first 16 RGB4 words in CHAR resource',
      tile_count: assets.tiles.length,
      tile_size: [16, 16]
    },
    mmap: {
      decompressed_size: assets.mapIndices.length,
      layout_status: 'solved: row-major 160x99 tile map',
      map_grid_tiles: [160, 99],
      map_size_pixels: [2560, 1584],
      scroll_limits_pixels: [2240, 1392],
      viewport_size_pixels: [320, 192]
    },
    outputs: {
      base_map: basename(baseMapPath),
      tile_sheet: basename(tileSheetPath),
      top_left_view: basename(topLeftViewPath)
    },
    source: 'AMaps.res'
  };
  writeFileSync(manifestPath, stringifySortedJson(manifest), 'utf8');
  return manifest;
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      out: { default: 'extracted_graphics/campaign_map', type: 'string' }
    }
  });
  const archive = positionals[0] ?? DEFAULT_ARCHIVE;
  const out = values.out ?? 'extracted_graphics/campaign_map';
  const manifest = renderCampaignOutputs(archive, out);
  console.log(
    `decoded ${manifest.char.tile_count} campaign tiles and ${manifest.mmap.decompressed_size} MMAP bytes; outputs written to ${out}`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
