import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';

import {
  CAMPAIGN_ICONS,
  isNearBlack,
  loadCampaignAssets,
  loadFullMapAssets,
  type FullMapPalette,
  type Manifest,
  type ManifestAsset
} from './assets';
import { FIXED_FONT } from './test-font';
import { TOPAZ_ALT_METRICS } from './topaz-alt';

const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
const documentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'document'
);
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
  if (documentDescriptor) {
    Object.defineProperty(globalThis, 'document', documentDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'document');
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
  // A canvas for the hand-drawn font's sheet, drawn when no ROM font is.
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        getContext: () => ({ fillRect: () => {} })
      })
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
  // No topaz/8 was exported, so the hi-res lettering is our own.
  expect(assets.hiresFont.metrics).toBe(TOPAZ_ALT_METRICS);
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

test('Full Map Level letters in topaz/8 when it was exported', async () => {
  serveAssets({
    assets: [
      ...manifest.assets,
      asset('font-metrics', 'type/topaz.json', 'topaz-8'),
      asset('font-sheet', 'type/topaz.png', 'topaz-8')
    ]
  });
  const topaz = { ...FIXED_FONT, height: 8 };
  fetchMock.mockResolvedValueOnce(Response.json(topaz));

  const assets = await loadFullMapAssets('/custom/');

  expect(assets.hiresFont.metrics).toEqual(topaz);
  expect(loadedImages).toContain('/custom/type/topaz.png');
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

test('black read back with fingerprinting noise is still black, colour 2 is not', () => {
  expect(isNearBlack(0, 0, 0)).toBe(true);
  expect(isNearBlack(1, 0, 2)).toBe(true);
  expect(isNearBlack(17, 0, 0)).toBe(false);
  expect(isNearBlack(17, 17, 17)).toBe(false);
});

test('Campaign Level loads all five column icons with clear backgrounds and opaque artwork', async () => {
  const campaignManifest: Manifest = {
    assets: [
      ...[
        'tile-atlas',
        'tilemap',
        'tile-atlas-metadata',
        'starting-state',
        'text',
        'palette',
        'window-frame'
      ].map(kind => asset(kind, kind)),
      asset('font-metrics', 'metrics', 'lord-10'),
      asset('font-sheet', 'font.png', 'lord-10'),
      ...[100, ...CAMPAIGN_ICONS.map(icon => icon.id)].map(id => ({
        ...asset('graphics', `icon-${id}.png`),
        source: { id, resource_file: 'AMaps.res', type: 'IMAG' }
      }))
    ]
  };
  for (const json of [
    campaignManifest,
    {}, // tile map
    {}, // atlas metadata
    {}, // starting state
    { resources: [] },
    { hex: Array.from({ length: 16 }, () => '#000000') },
    FIXED_FONT
  ]) {
    fetchMock.mockResolvedValueOnce(Response.json(json));
  }

  // A three-pixel bitmap: colour 0, the near-black outline colour 2,
  // and red artwork. Model canvas copies so we can inspect loaded pixels.
  const opaquePixels = new Uint8ClampedArray([
    0, 0, 0, 255, 17, 0, 0, 255, 255, 0, 0, 255
  ]);
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      height = 1;
      width = 3;
      pixels = opaquePixels.slice();
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        const canvas = {
          getContext: () => ({
            drawImage: (image: { pixels: Uint8ClampedArray }) => {
              canvas.pixels = image.pixels.slice();
            },
            getImageData: () => ({ data: canvas.pixels.slice() }),
            putImageData: (image: { data: Uint8ClampedArray }) => {
              canvas.pixels = image.data.slice();
            }
          }),
          height: 0,
          pixels: new Uint8ClampedArray(),
          width: 0
        };
        return canvas;
      }
    }
  });

  const assets = await loadCampaignAssets();

  expect(assets.icons.map(icon => icon.name)).toEqual([
    'eye',
    'map',
    'magnifying-glass',
    'hourglass',
    'arrow'
  ]);
  for (const { image } of assets.icons) {
    expect(image).toMatchObject({
      height: 1,
      pixels: new Uint8ClampedArray([
        0, 0, 0, 0, 17, 0, 0, 255, 255, 0, 0, 255
      ]),
      width: 3
    });
  }
});
