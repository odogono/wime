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
  icons: CampaignIcon[];
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
// finding:graphics-campaign-icon-imag-ids. None is wired up yet: the
// hourglass belongs to Game Speed (#7) and the arrow to Orders (#10).
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

  const [atlas, tilemap, tiles] = await Promise.all([
    loadImage(base + atlasAsset.path),
    fetchJson<Tilemap>(base + tilemapAsset.path),
    fetchJson<TilesMeta>(base + tilesAsset.path)
  ]);

  const icons: CampaignIcon[] = [];
  for (const { id, name } of CAMPAIGN_ICONS) {
    const asset = assetBySource(manifest, 'AMaps.res', 'IMAG', id);
    if (asset) {
      icons.push({ image: await loadImage(base + asset.path), name });
    }
  }

  return { atlas, icons, tilemap, tiles };
};
