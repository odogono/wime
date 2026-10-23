// Throwaway Campaign Level compositor: original map data, reusable painted art.
// No generated or extracted bytes are written to tracked paths (ADR-0003).
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

interface Source {
  sha256: string;
  transparent: boolean;
  url: string;
}
interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}
interface Place {
  name: string;
  position: { x: number; y: number };
  tile_kind: string | null;
}

const root = join(import.meta.dir, '..');
const outputDir = join(root, 'build/graphics-remaster');
const assetDir = join(outputDir, 'campaign-assets');
await mkdir(assetDir, { recursive: true });
const manifest: Record<string, Source> = await Bun.file(
  join(root, 'web/src/view/campaign-prototype-assets.json')
).json();
const hash = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');
const dataUrl = (bytes: Uint8Array): string =>
  `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;

// The generator's objects do not fit exact equal cells. These reviewed gutters
// separate the original PNGs without resampling, editing or rewriting them.
const regions: Record<string, Rect[]> = {
  nature: [
    { height: 560, width: 560, x: 0, y: 0 },
    { height: 560, width: 470, x: 560, y: 0 },
    { height: 560, width: 506, x: 1030, y: 0 },
    { height: 464, width: 500, x: 0, y: 560 },
    { height: 464, width: 580, x: 500, y: 560 },
    { height: 464, width: 456, x: 1080, y: 560 }
  ],
  settlements: Array.from({ length: 6 }, (_, i) => ({
    height: 512,
    width: 512,
    x: (i % 3) * 512,
    y: Math.floor(i / 3) * 512
  }))
};

const artEntries = await Promise.all(
  Object.entries(manifest).map(async ([name, source]) => {
    const file = Bun.file(join(assetDir, `${name}.png`));
    let bytes = (await file.exists()) ? await file.bytes() : null;
    if (!bytes || hash(bytes) !== source.sha256) {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Could not download ${name}: HTTP ${response.status}`);
      }
      bytes = new Uint8Array(await response.arrayBuffer());
      if (hash(bytes) !== source.sha256) {
        throw new Error(`Pinned artwork hash mismatch: ${name}`);
      }
      await Bun.write(file, bytes);
    }
    const png = PNG.sync.read(Buffer.from(bytes));
    if (
      source.transparent &&
      !png.data.some((v, i) => i % 4 === 3 && v === 0)
    ) {
      throw new Error(`${name} has no transparent background`);
    }
    const frames = (regions[name] ?? []).map(region => {
      let left = region.x + region.width;
      let top = region.y + region.height;
      let right = region.x;
      let bottom = region.y;
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          if (png.data[(y * png.width + x) * 4 + 3]! > 128) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }
      if (left > right || top > bottom) {
        throw new Error(`Empty sprite in ${name}`);
      }
      // A small gutter retains the soft contact shadow and antialiasing.
      const x = Math.max(region.x, left - 6);
      const y = Math.max(region.y, top - 6);
      return {
        height: Math.min(region.y + region.height, bottom + 7) - y,
        width: Math.min(region.x + region.width, right + 7) - x,
        x,
        y
      };
    });
    return [name, { frames, src: dataUrl(bytes) }] as const;
  })
);

// Map dimensions/layout: finding:data-formats-campaign-map-grid. This bounded
// crop covers Bree, Weathertop and Rivendell, with extra room for scrolling.
const region = { height: 32, width: 44, x: 40, y: 14 };
const assetPath = join(root, 'web/public/assets');
const tilemap: { indices: number[]; width: number } = await Bun.file(
  join(assetPath, 'campaign/tilemap.json')
).json();
const starting: {
  place_kinds: { name: string; tile: number }[];
  places: Place[];
} = await Bun.file(join(assetPath, 'starting-state.json')).json();
const atlas = PNG.sync.read(
  Buffer.from(await Bun.file(join(assetPath, 'campaign/tiles.png')).bytes())
);
const width = region.width * 16;
const height = region.height * 16;
const original = new PNG({ height, width });
const water = new PNG({ height, width });
const roads = new PNG({ height, width });
const tiles = [];
const kinds = new Map(starting.place_kinds.map(p => [p.tile, p.name]));
// Named landmarks whose original tiles are not in the generic Place-kind list.
// These are explicitly chosen prototype symbols, not inferred game semantics.
const landmarkFrames = new Map([
  ['HOBBITON', 0],
  ['WOODHALL', 5],
  ["BOMBADIL'S HOUSE", 5],
  ["DEADMAN'S DIKE", 3],
  ['WEATHERTOP', 3],
  ['RIVENDELL', 4]
]);
const isWater = (r: number, g: number, b: number): boolean =>
  (r === 85 && g === 136 && b === 255) || (r === 136 && g === 187 && b === 255);

for (let ty = 0; ty < region.height; ty++) {
  for (let tx = 0; tx < region.width; tx++) {
    const id =
      tilemap.indices[(ty + region.y) * tilemap.width + tx + region.x]!;
    const pixels: number[][] = [];
    let forest = 0;
    let rock = 0;
    let hill = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const source =
          ((Math.floor(id / 32) * 16 + y) * atlas.width + (id % 32) * 16 + x) *
          4;
        const destination = ((ty * 16 + y) * width + tx * 16 + x) * 4;
        atlas.data.copy(original.data, destination, source, source + 4);
        const r = atlas.data[source]!;
        const g = atlas.data[source + 1]!;
        const b = atlas.data[source + 2]!;
        const trees =
          (r === 51 && g === 102 && b === 17) ||
          (r === 34 && g === 68 && b === 17);
        const rocks = r === 136 && g === 136 && b === 136;
        const hills = r === 238 && g === 170 && b === 136;
        forest += Number(trees);
        rock += Number(rocks);
        hill += Number(hills);
        pixels.push([Number(trees), Number(rocks), Number(isWater(r, g, b))]);
        if (isWater(r, g, b)) {
          water.data.set([255, 255, 255, 255], destination);
        }
        if (hills) {
          roads.data.set([255, 255, 255, 255], destination);
        }
      }
    }
    const named = starting.places.find(
      p =>
        p.position.x === (tx + region.x) * 16 &&
        p.position.y === (ty + region.y) * 16
    );
    const symbol = named ? landmarkFrames.get(named.name) : undefined;
    const kind =
      kinds.get(id) ?? (symbol === undefined ? undefined : 'landmark');
    // These are experimental visual classifications, not original game rules.
    const category = kind
      ? 'place'
      : rock >= 8
        ? 'mountain'
        : hill >= 22
          ? 'hill'
          : forest >= 12
            ? 'forest'
            : 'grass';
    tiles.push({
      category,
      id,
      kind: kind ?? null,
      pixels,
      symbol: symbol ?? null,
      x: tx,
      y: ty
    });
    // Peach pixels on hills/buildings describe scenery, not a path.
    if (category !== 'grass' && category !== 'forest') {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          roads.data[((ty * 16 + y) * width + tx * 16 + x) * 4 + 3] = 0;
        }
      }
    }
  }
}
const places = starting.places
  .filter(p => {
    const x = p.position.x / 16 - region.x;
    const y = p.position.y / 16 - region.y;
    return x >= 0 && x < region.width && y >= 0 && y < region.height;
  })
  .map(p => ({
    name: p.name,
    x: p.position.x - region.x * 16 + 8,
    y: p.position.y - region.y * 16 + 8
  }));
const originalBytes = PNG.sync.write(original);
await Bun.write(join(outputDir, 'campaign-region-source.png'), originalBytes);
const data = {
  art: Object.fromEntries(artEntries),
  height,
  original: dataUrl(originalBytes),
  places,
  region,
  roads: dataUrl(PNG.sync.write(roads)),
  tiles,
  water: dataUrl(PNG.sync.write(water)),
  width
};
const template = await Bun.file(
  join(root, 'web/src/view/campaign-prototype.html')
).text();
const output = join(outputDir, 'campaign-prototype.html');
await Bun.write(
  output,
  template.replace('__CAMPAIGN_DATA__', JSON.stringify(data))
);
console.log(`Built ${output}`);
console.log(`${tiles.length} original tiles; ${places.length} named Places.`);
console.log(
  'Open the HTML directly. All data and artwork are embedded offline.'
);
