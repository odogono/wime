import type { AnimationTables } from './animation-scene';
import type { Font, FontMetrics } from './font';
import type { MenuColours } from './menu-window';
import { topazAltFont } from './topaz-alt';
import {
  ANIMATION_PARCHMENT,
  windowStyle,
  type WindowStyle
} from './window-frame';

// Loads the assets exported by `bun run export:web` (#3). The view layer
// finds every asset through the manifest (issue #8 acceptance): the only
// path named here is the manifest itself, under Vite's public dir.
export interface AssetSource {
  id: number | null;
  resource_file: string;
  type: string;
}

export interface ManifestAsset {
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
}

export interface Manifest {
  assets: ManifestAsset[];
}

export interface Tilemap {
  height: number;
  indices: number[];
  stride: number;
  tile_height: number;
  tile_width: number;
  width: number;
}

export interface TilesMeta {
  atlas: string;
  columns: number;
  height: number;
  rows: number;
  tile_count: number;
  tile_height: number;
  tile_width: number;
  width: number;
}

export interface CampaignIcon {
  image: HTMLImageElement;
  name: string;
}

export interface CampaignAssets {
  atlas: HTMLImageElement;
  // The Campaign Level icon sheet: the figures and badges the Forces
  // are drawn with (finding:graphics-campaign-icon-sheet-is-imag-100),
  // with its black background made transparent so an icon sits on the
  // map instead of in a black square.
  forceIcons: CanvasImageSource & { height: number; width: number };
  icons: CampaignIcon[];
  // The parsed starting-state.json, still unvalidated here: the sim
  // loads and checks it (loadStartingState in src/sim), so a bad asset
  // fails there with the sim's own error.
  startingState: unknown;
  // The CSTR text resources, by "<resource file>#<id>", such as
  // "BScene.res#50".
  texts: Map<string, string>;
  tilemap: Tilemap;
  tiles: TilesMeta;
  // How windows look on the Campaign Level
  // (finding:ui-window-frame-tiles).
  window: WindowStyle;
}

interface TextResources {
  resources: { id: number; source_file: string; text: string }[];
}

export const textKey = (file: string, id: number): string => `${file}#${id}`;

export const textsByKey = (resources: TextResources): Map<string, string> =>
  new Map(
    resources.resources.map(resource => [
      textKey(resource.source_file, resource.id),
      resource.text
    ])
  );

export const FULL_MAP_ICON_NAMES = [
  'eye',
  'scroll',
  'magnifying-glass',
  'hourglass'
] as const;

export interface FullMapPalette {
  colors: [number, number, number][];
  hex: string[];
  palette_source: string;
  source: AssetSource | null;
  warnings?: string[];
}

export interface FullMapAssets {
  font: Font;
  // The hi-res lettering: topaz/8 when it was exported from a Kickstart
  // ROM, otherwise our own font in its spirit (topaz-alt.ts).
  hiresFont: Font;
  icons: {
    image: HTMLImageElement;
    name: (typeof FULL_MAP_ICON_NAMES)[number];
  }[];
  map: HTMLImageElement;
  palette: FullMapPalette;
  // The window frame tiles in the Full Map Level palette
  // (finding:ui-window-frame-tiles), colour 0 still black.
  windowFrame: HTMLImageElement;
}

export const assetByKind = (
  manifest: Manifest,
  kind: string
): ManifestAsset | undefined =>
  manifest.assets.find(asset => asset.kind === kind);

export const assetBySource = (
  manifest: Manifest,
  resourceFile: string,
  type: string,
  id: number
): ManifestAsset | undefined =>
  manifest.assets.find(
    asset =>
      asset.source?.resource_file === resourceFile &&
      asset.source.type === type &&
      asset.source.id === id
  );

const requireAsset = (
  asset: ManifestAsset | undefined,
  what: string
): ManifestAsset => {
  if (!asset) {
    throw new Error(`Asset manifest has no ${what}; run bun run export:web`);
  }
  return asset;
};

// The Campaign Level icons, top to bottom as the manual lists them
// (finding:ui-campaign-level-display). The IMAG ids are identified in
// finding:graphics-campaign-icon-imag-ids. The hourglass is wired to
// Game Speed (#7); the arrow is wired to Orders (#10).
export const CAMPAIGN_ICONS: { id: number; name: string }[] = [
  { id: 26, name: 'eye' },
  { id: 30, name: 'map' },
  { id: 28, name: 'magnifying-glass' },
  { id: 27, name: 'hourglass' },
  { id: 31, name: 'arrow' }
];

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
};

// A text font's glyph sheet and metrics (finding:ui-text-font-lord-10):
// lord/10, or the Full Map Level's topaz/8, which is exported only when
// a Kickstart ROM was at hand, so it may be missing.
const fontAsset = (
  manifest: Manifest,
  name: string,
  kind: string
): ManifestAsset | undefined =>
  manifest.assets.find(asset => asset.kind === kind && asset.name === name);

const loadNamedFont = async (
  manifest: Manifest,
  base: string,
  name: string
): Promise<Font | undefined> => {
  const sheetAsset = fontAsset(manifest, name, 'font-sheet');
  const metricsAsset = fontAsset(manifest, name, 'font-metrics');
  if (!sheetAsset || !metricsAsset) {
    return undefined;
  }
  const [sheet, metrics] = await Promise.all([
    loadImage(base + sheetAsset.path),
    fetchJson<FontMetrics>(base + metricsAsset.path)
  ]);
  return { metrics, sheet };
};

const loadFont = async (manifest: Manifest, base: string): Promise<Font> => {
  const font = await loadNamedFont(manifest, base, 'lord-10');
  if (!font) {
    throw new Error(
      'Asset manifest has no lord/10 font; run bun run export:web'
    );
  }
  return font;
};

// Pure black is colour 0 of the sheet's palette, its background. The
// figures and badges are outlined in other colours, so clearing black
// to transparent keeps every icon's shape. How the original masked
// its blit has not been traced; this is provisional.
export const blackToTransparent = (
  image: HTMLImageElement
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D is not available');
  }
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (
      pixels.data[i] === 0 &&
      pixels.data[i + 1] === 0 &&
      pixels.data[i + 2] === 0
    ) {
      pixels.data[i + 3] = 0;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
};

export const loadCampaignAssets = async (
  base = '/assets/'
): Promise<CampaignAssets> => {
  const manifest = await fetchJson<Manifest>(`${base}manifest.json`);
  const atlasAsset = requireAsset(
    assetByKind(manifest, 'tile-atlas'),
    'tile atlas'
  );
  const tilemapAsset = requireAsset(
    assetByKind(manifest, 'tilemap'),
    'tile map'
  );
  const tilesAsset = requireAsset(
    assetByKind(manifest, 'tile-atlas-metadata'),
    'tile atlas metadata'
  );
  const startingStateAsset = requireAsset(
    assetByKind(manifest, 'starting-state'),
    'starting state'
  );
  const textAsset = requireAsset(assetByKind(manifest, 'text'), 'text');
  const paletteAsset = requireAsset(
    assetByKind(manifest, 'palette'),
    'Campaign Level palette'
  );
  const frameAsset = requireAsset(
    assetByKind(manifest, 'window-frame'),
    'window frame tiles'
  );
  // AMaps.res IMAG 100 is the sheet of Campaign Level figures and
  // badges (finding:graphics-campaign-icon-sheet-is-imag-100).
  const forceIconsAsset = requireAsset(
    assetBySource(manifest, 'AMaps.res', 'IMAG', 100),
    'Campaign Level icon sheet (AMaps.res IMAG 100)'
  );

  const [
    atlas,
    tilemap,
    tiles,
    startingState,
    forceIconSheet,
    texts,
    palette,
    frame,
    font
  ] = await Promise.all([
    loadImage(base + atlasAsset.path),
    fetchJson<Tilemap>(base + tilemapAsset.path),
    fetchJson<TilesMeta>(base + tilesAsset.path),
    fetchJson<unknown>(base + startingStateAsset.path),
    loadImage(base + forceIconsAsset.path),
    fetchJson<TextResources>(base + textAsset.path),
    fetchJson<{ hex: string[] }>(base + paletteAsset.path),
    loadImage(base + frameAsset.path),
    loadFont(manifest, base)
  ]);

  const icons: CampaignIcon[] = [];
  for (const { id, name } of CAMPAIGN_ICONS) {
    const asset = assetBySource(manifest, 'AMaps.res', 'IMAG', id);
    if (asset) {
      icons.push({ image: await loadImage(base + asset.path), name });
    }
  }

  return {
    atlas,
    forceIcons: blackToTransparent(forceIconSheet),
    icons,
    startingState,
    texts: textsByKey(texts),
    tilemap,
    tiles,
    window: windowStyle(blackToTransparent(frame), palette.hex, font)
  };
};

// Full Map Level bitmaps retain their native hi-res dimensions. Their
// names and paths come from the manifest, including shared provenance
// and the explicitly provisional palette (issue #29).
export const loadFullMapAssets = async (
  base = '/assets/'
): Promise<FullMapAssets> => {
  const manifest = await fetchJson<Manifest>(`${base}manifest.json`);
  const mapAsset = requireAsset(
    assetByKind(manifest, 'full-map'),
    'Full Map Level art'
  );
  const paletteAsset = requireAsset(
    assetByKind(manifest, 'full-map-palette'),
    'Full Map Level palette'
  );
  const frameAsset = requireAsset(
    assetByKind(manifest, 'full-map-window-frame'),
    'Full Map Level window frame tiles'
  );
  const iconAssets = FULL_MAP_ICON_NAMES.map(name => ({
    asset: requireAsset(
      manifest.assets.find(
        asset => asset.kind === 'full-map-icon' && asset.name === name
      ),
      `Full Map Level ${name} icon`
    ),
    name
  }));

  const [map, palette, frame, icons, font, topaz] = await Promise.all([
    loadImage(base + mapAsset.path),
    fetchJson<FullMapPalette>(base + paletteAsset.path),
    loadImage(base + frameAsset.path),
    Promise.all(
      iconAssets.map(async ({ asset, name }) => ({
        image: await loadImage(base + asset.path),
        name
      }))
    ),
    loadFont(manifest, base),
    loadNamedFont(manifest, base, 'topaz-8')
  ]);
  return {
    font,
    hiresFont: topaz ?? topazAltFont(),
    icons,
    map,
    palette,
    windowFrame: frame
  };
};

// One figure set: its sheet and where each frame lies in it
// (animation/figures.json, finding:data-formats-frml-frame-lists).
export interface FigureFrame {
  height: number;
  hot_x: number;
  hot_y: number;
  width: number;
  x: number;
}

export interface FigureSetAsset {
  colour_rows: Record<number, number>;
  depth: number;
  frames: FigureFrame[];
  id: number;
  sheet: HTMLImageElement;
}

export interface AnimationIcon {
  button: number;
  image: HTMLImageElement;
  name: string;
  // Where the original centres it (finding:ui-animation-level-icons).
  x: number;
  y: number;
}

const OBJECT_PICTURE_BASE = 50;
const OBJECT_PICTURES = 16;

export interface AnimationAssets {
  figures: Map<number, FigureSetAsset>;
  icons: AnimationIcon[];
  // Objects lying on the ground, by object: BScene.res IMAG 50 plus the
  // object, colour 0 clear
  // (finding:objects-lying-on-the-ground-are-pictures).
  objectPictures: Map<number, CanvasImageSource>;
  // The 32 colours (finding:graphics-animation-level-palette).
  palette: string[];
  // Scenery strips by IMAG id, colour 0 clear.
  strips: Map<number, CanvasImageSource & { height: number; width: number }>;
  tables: AnimationTables;
  window: WindowStyle;
}

interface FiguresJson {
  figures: {
    colour_rows: Record<number, number>;
    depth: number;
    frames: FigureFrame[];
    id: number;
    path: string;
  }[];
  icons: { button: number; imag: number; name: string; x: number; y: number }[];
}

// The Animation Level's art (docs/spec/animation-level.md). Its strips
// are every AScene.res and BScene.res bitmap; figures, icons and tables
// are under animation/.
export const loadAnimationAssets = async (
  base = '/assets/'
): Promise<AnimationAssets> => {
  const manifest = await fetchJson<Manifest>(`${base}manifest.json`);
  const animationPath = (name: string): string =>
    base +
    requireAsset(
      manifest.assets.find(asset => asset.path === `animation/${name}`),
      `Animation Level ${name}`
    ).path;
  const [palette, tables, figures, frame, font] = await Promise.all([
    fetchJson<{ hex: string[] }>(animationPath('palette.json')),
    fetchJson<AnimationTables>(animationPath('tables.json')),
    fetchJson<FiguresJson>(animationPath('figures.json')),
    loadImage(animationPath('window-frame.png')),
    loadFont(manifest, base)
  ]);
  const stripAssets = manifest.assets.filter(
    asset =>
      asset.kind === 'graphics' &&
      asset.source?.id !== null &&
      (asset.source?.resource_file === 'AScene.res' ||
        asset.source?.resource_file === 'BScene.res')
  );
  const [sets, icons, strips] = await Promise.all([
    Promise.all(
      figures.figures.map(async set => ({
        colour_rows: set.colour_rows,
        depth: set.depth,
        frames: set.frames,
        id: set.id,
        sheet: await loadImage(`${base}animation/${set.path}`)
      }))
    ),
    Promise.all(
      figures.icons.map(async icon => ({
        button: icon.button,
        image: await loadImage(animationPath(`icon-${icon.name}.png`)),
        name: icon.name,
        x: icon.x,
        y: icon.y
      }))
    ),
    Promise.all(
      stripAssets.map(
        async asset =>
          [
            asset.source!.id!,
            blackToTransparent(await loadImage(base + asset.path))
          ] as const
      )
    )
  ]);
  const objectPictures = await Promise.all(
    Array.from({ length: OBJECT_PICTURES }, async (_, object) => {
      const asset = assetBySource(
        manifest,
        'BScene.res',
        'IMAG',
        OBJECT_PICTURE_BASE + object
      );
      return asset
        ? ([
            object,
            blackToTransparent(await loadImage(base + asset.path))
          ] as const)
        : null;
    })
  );
  return {
    figures: new Map(sets.map(set => [set.id, set])),
    icons,
    objectPictures: new Map(objectPictures.filter(entry => entry !== null)),
    palette: palette.hex,
    strips: new Map(strips),
    tables,
    window: windowStyle(frame, palette.hex, font, ANIMATION_PARCHMENT)
  };
};

export interface TitleAssets {
  font: Font;
  // The title menu's colours, from the Animation Level's palette as
  // its window is: dark red for the selected row, grey for a save that
  // cannot be loaded (docs/spec/title-menu.md).
  menuColours: MenuColours;
  // The title palette as hex (finding:graphics-title-screen-palette).
  palette: string[];
  // ATitle.res IMAG 70 to 73, by id; the logo's black is clear so the
  // title screen shows round it.
  pictures: Map<number, CanvasImageSource>;
  // The Ring verse's window: cream parchment, drawn like a message box
  // on the Animation Level (finding:ui-ring-verse-window).
  window: WindowStyle;
}

// The boot sequence's art (docs/spec/boot-sequence.md).
export const loadTitleAssets = async (
  base = '/assets/'
): Promise<TitleAssets> => {
  const manifest = await fetchJson<Manifest>(`${base}manifest.json`);
  const ids = [70, 71, 72, 73];
  const animationPath = (name: string): string =>
    base +
    requireAsset(
      manifest.assets.find(asset => asset.path === `animation/${name}`),
      `Animation Level ${name}`
    ).path;
  const [palette, windowPalette, frame, font, pictures] = await Promise.all([
    fetchJson<{ hex: string[] }>(
      base +
        requireAsset(assetByKind(manifest, 'title-palette'), 'title palette')
          .path
    ),
    fetchJson<{ hex: string[] }>(animationPath('palette.json')),
    loadImage(animationPath('window-frame.png')),
    loadFont(manifest, base),
    Promise.all(
      ids.map(id =>
        loadImage(
          base +
            requireAsset(
              assetBySource(manifest, 'ATitle.res', 'IMAG', id),
              `ATitle.res IMAG ${id}`
            ).path
        )
      )
    )
  ]);
  return {
    font,
    menuColours: {
      dim: windowPalette.hex[22]!,
      selected: windowPalette.hex[18]!
    },
    palette: palette.hex,
    pictures: new Map(
      pictures.map((image, i) => [
        ids[i]!,
        ids[i] === 73 ? blackToTransparent(image) : image
      ])
    ),
    window: windowStyle(frame, windowPalette.hex, font, ANIMATION_PARCHMENT)
  };
};
