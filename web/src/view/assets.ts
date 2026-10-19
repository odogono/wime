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
  tilemap: Tilemap;
  tiles: TilesMeta;
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
  // AMaps.res IMAG 100 is the sheet of Campaign Level figures and
  // badges (finding:graphics-campaign-icon-sheet-is-imag-100).
  const forceIconsAsset = requireAsset(
    assetBySource(manifest, 'AMaps.res', 'IMAG', 100),
    'Campaign Level icon sheet (AMaps.res IMAG 100)'
  );

  const [atlas, tilemap, tiles, startingState, forceIconSheet] =
    await Promise.all([
      loadImage(base + atlasAsset.path),
      fetchJson<Tilemap>(base + tilemapAsset.path),
      fetchJson<TilesMeta>(base + tilesAsset.path),
      fetchJson<unknown>(base + startingStateAsset.path),
      loadImage(base + forceIconsAsset.path)
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
    tilemap,
    tiles
  };
};
