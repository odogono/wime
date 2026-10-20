import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';

import {
  loadFullMapAssets,
  type FullMapPalette,
  type Manifest,
  type ManifestAsset
} from './assets';
import { FIXED_FONT } from './test-font';

const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
const loadedImages: string[] = [];
const fetchMock = spyOn(globalThis, 'fetch');
afterAll(() => fetchMock.mockRestore());

afterEach(() => {
  fetchMock.mockReset();
  loadedImages.length = 0;
  if (imageDescriptor) {
    Object.defineProperty(globalThis, 'Image', imageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'Image');
  }
});

const asset = (kind: string, path: string, name?: string): ManifestAsset => ({
  height: null,
  kind,
  ...(name ? { name } : {}),
  path,
  source: null,
  width: null
});

const manifest: Manifest = {
  // Deliberately shuffled, with paths unlike the exporter's defaults.
  assets: [
    asset('full-map-icon', 'icons/time.png', 'hourglass'),
    asset('full-map-palette', 'colours.json'),
    asset('full-map-icon', 'icons/down.png', 'magnifying-glass'),
    asset('full-map', 'middle-earth.png'),
    asset('full-map-icon', 'icons/status.png', 'eye'),
    asset('full-map-icon', 'icons/archive.png', 'scroll'),
    asset('full-map-window-frame', 'frame.png'),
    asset('font-metrics', 'type/lord.json', 'lord-10'),
    asset('font-sheet', 'type/lord.png', 'lord-10')
  ]
};

const serveAssets = (assets: Manifest) => {
  const palette: FullMapPalette = {
    colors: [[255, 238, 170]],
    hex: ['#ffeeaa'],
    palette_source: 'Provisional hand-entered full-map palette',
    source: null,
    warnings: ['Full Map Level colours are provisional.']
  };
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  fetchMock.mockResolvedValueOnce(Response.json(assets));
  fetchMock.mockResolvedValueOnce(Response.json(palette));
  fetchMock.mockResolvedValueOnce(Response.json(FIXED_FONT));
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      onload: (() => void) | null = null;
      set src(value: string) {
        loadedImages.push(value);
        this.onload?.();
      }
    }
  });
  return palette;
};

test('Full Map Level loads manifest paths, column order and palette provenance', async () => {
  const palette = serveAssets(manifest);
  const assets = await loadFullMapAssets('/custom/');

  expect(assets.map).toBeDefined();
  expect(assets.palette).toEqual(palette);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/custom/manifest.json',
    '/custom/colours.json',
    '/custom/type/lord.json'
  ]);
  expect(assets.font.metrics).toEqual(FIXED_FONT);
  expect(assets.icons.map(icon => icon.name)).toEqual([
    'eye',
    'scroll',
    'magnifying-glass',
    'hourglass'
  ]);
  expect(loadedImages).toEqual([
    '/custom/middle-earth.png',
    '/custom/frame.png',
    '/custom/icons/status.png',
    '/custom/icons/archive.png',
    '/custom/icons/down.png',
    '/custom/icons/time.png',
    '/custom/type/lord.png'
  ]);
});

test('Full Map Level refuses an incomplete icon column', async () => {
  serveAssets({
    assets: manifest.assets.filter(asset => asset.name !== 'scroll')
  });

  await expect(loadFullMapAssets('/custom/')).rejects.toThrow(
    'Asset manifest has no Full Map Level scroll icon; run bun run export:web'
  );
  expect(loadedImages).toEqual([]);
});
