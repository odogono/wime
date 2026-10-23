// Build the throwaway painted river experiment into one offline HTML file.
// PNGs stay gitignored; the tracked manifest pins their secret-gist bytes.
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface AssetSource {
  sha256: string;
  transparent: boolean;
  url: string;
}

const root = join(import.meta.dir, '..');
const outputDir = join(root, 'build/graphics-remaster');
const assetDir = join(outputDir, 'river-assets');
await mkdir(assetDir, { recursive: true });
const manifest: Record<string, AssetSource> = await Bun.file(
  join(root, 'web/src/view/river-prototype-assets.json')
).json();

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

// Inspect alpha bounds only; the PNG bytes themselves are never rewritten.
const bounds = (image: PNG, region: Rect): Rect => {
  let left = region.x + region.width;
  let right = region.x - 1;
  let top = region.y + region.height;
  let bottom = region.y - 1;
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3]! >= 32) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) {
    throw new Error('An artwork region is empty.');
  }
  return { height: bottom - top + 1, width: right - left + 1, x: left, y: top };
};

const entries = await Promise.all(
  Object.entries(manifest).map(async ([name, source]) => {
    const file = Bun.file(join(assetDir, `${name}.png`));
    let bytes = (await file.exists()) ? await file.bytes() : null;
    if (!bytes || sha256(bytes) !== source.sha256) {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Could not download ${name}: HTTP ${response.status}`);
      }
      bytes = new Uint8Array(await response.arrayBuffer());
      if (sha256(bytes) !== source.sha256) {
        throw new Error(`The pinned artwork hash does not match for ${name}.`);
      }
      await Bun.write(file, bytes);
    }
    const image = PNG.sync.read(Buffer.from(bytes));
    if (
      source.transparent &&
      !image.data.some((value, index) => index % 4 === 3 && value === 0)
    ) {
      throw new Error(`${name} has no transparent background.`);
    }
    const full = { height: image.height, width: image.width, x: 0, y: 0 };
    const asset = {
      bounds: bounds(image, full),
      height: image.height,
      src: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
      width: image.width
    };
    if (name !== 'hobbit-walk') {
      return [name, asset] as const;
    }
    if (image.width % 4 !== 0 || image.height % 2 !== 0) {
      throw new Error('The hobbit sheet must fit a 4 by 2 frame grid.');
    }
    const width = image.width / 4;
    const height = image.height / 2;
    const frames = Array.from({ length: 8 }, (_, index) => {
      const region = {
        height,
        width,
        x: (index % 4) * width,
        y: Math.floor(index / 4) * height
      };
      const occupied = bounds(image, region);
      return {
        ...region,
        figureHeight: occupied.height,
        footY: occupied.y + occupied.height - region.y
      };
    });
    return [
      name,
      {
        ...asset,
        figureHeight: Math.max(...frames.map(frame => frame.figureHeight)),
        frames
      }
    ] as const;
  })
);

const template = await Bun.file(
  join(root, 'web/src/view/river-prototype.html')
).text();
const output = join(outputDir, 'river-prototype.html');
await Bun.write(
  output,
  template.replace(
    '__RIVER_ASSETS__',
    JSON.stringify(Object.fromEntries(entries))
  )
);
console.log(`Built ${output}`);
console.log(
  'Open this HTML file directly; all six images are embedded for offline use.'
);
