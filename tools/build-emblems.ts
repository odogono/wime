#!/usr/bin/env bun
// Compile the Atlas map's emblems into one signed distance field atlas
// (ADR-0007, docs/spec/atlas-emblems.md).
//
//   bun tools/build-emblems.ts [--out DIR]
//
// Each SVG in web/src/view/atlas/emblems/ is drawn at SCALE texels per
// unit of its 64-unit box, and every pixel is sorted into one of the
// sheet's three tones. The atlas holds a distance field per tone: red is
// ink, green the whole silhouette and blue the parchment device. The
// field is drawn in the Side colour wherever neither ink nor device lies.
// Writes DIR/atlas.bin (RGB, row by row, gzipped) and DIR/atlas.json (default
// web/public/assets/emblems/).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

import { Resvg } from '@resvg/resvg-js';

import type { EmblemAtlas as WebEmblemAtlas } from '../web/src/view/atlas/emblems';
import { INF, edt } from '../web/src/view/atlas/sdf-font';

export const EMBLEM_DIR = 'web/src/view/atlas/emblems';
export const SCALE = 2;
// Texels the field spans either side of an edge: deep enough inside for
// a Compact marker's rim, which is cut from the silhouette's field.
export const RADIUS = 16;

const INK = [0x3a, 0x2c, 0x1c];
const FIELD = [0x2f, 0x58, 0xa8];
const PAPER = [0xf0, 0xe4, 0xc4];

type EmblemAtlas = Omit<WebEmblemAtlas, 'texture'>;

// The three tones' masks of one drawn emblem: each opaque pixel goes to
// the tone it is nearest.
export const toneMasks = (
  pixels: Uint8Array,
  size: number
): { body: Uint8Array; device: Uint8Array; ink: Uint8Array } => {
  const body = new Uint8Array(size * size);
  const ink = new Uint8Array(size * size);
  const device = new Uint8Array(size * size);
  const distance = (i: number, tone: number[]): number =>
    Math.hypot(
      pixels[i * 4]! - tone[0]!,
      pixels[i * 4 + 1]! - tone[1]!,
      pixels[i * 4 + 2]! - tone[2]!
    );
  for (let i = 0; i < size * size; i++) {
    if (pixels[i * 4 + 3]! < 128) {
      continue;
    }
    body[i] = 1;
    const [toInk, toField, toPaper] = [INK, FIELD, PAPER].map(t =>
      distance(i, t)
    );
    if (toInk! <= toField! && toInk! <= toPaper!) {
      ink[i] = 1;
    } else if (toPaper! < toField!) {
      device[i] = 1;
    }
  }
  return { body, device, ink };
};

// A mask's signed distance field, 128 on the edge and higher inside.
export const distanceField = (
  mask: Uint8Array,
  width: number,
  height: number
): Uint8Array => {
  const outside = new Float64Array(width * height);
  const inside = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    outside[i] = mask[i] ? 0 : INF;
    inside[i] = mask[i] ? INF : 0;
  }
  edt(outside, width, height);
  edt(inside, width, height);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const signed = outside[i]! - inside[i]!;
    out[i] = Math.max(
      0,
      Math.min(255, Math.round(128 - (signed / RADIUS) * 127))
    );
  }
  return out;
};

export const buildEmblems = (
  svgs: { name: string; svg: string }[]
): { atlas: EmblemAtlas; data: Uint8Array } => {
  const margin = RADIUS + 2;
  const art = 64 * SCALE;
  const cell = art + margin * 2;
  const columns = Math.ceil(Math.sqrt(svgs.length));
  const rows = Math.ceil(svgs.length / columns);
  const width = columns * cell;
  const height = rows * cell;
  const masks = {
    body: new Uint8Array(width * height),
    device: new Uint8Array(width * height),
    ink: new Uint8Array(width * height)
  };
  const cells: EmblemAtlas['cells'] = {};
  svgs.forEach(({ name, svg }, n) => {
    const u = (n % columns) * cell;
    const v = Math.floor(n / columns) * cell;
    cells[name] = { u, v };
    const drawn = new Resvg(svg, {
      fitTo: { mode: 'width', value: art },
      shapeRendering: 2
    }).render();
    const tones = toneMasks(new Uint8Array(drawn.pixels), art);
    for (let y = 0; y < art; y++) {
      for (let x = 0; x < art; x++) {
        const at = (v + margin + y) * width + u + margin + x;
        for (const tone of ['body', 'device', 'ink'] as const) {
          masks[tone][at] = tones[tone][y * art + x]!;
        }
      }
    }
  });
  const fields = [masks.ink, masks.body, masks.device].map(m =>
    distanceField(m, width, height)
  );
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) {
      data[i * 3 + c] = fields[c]![i]!;
    }
  }
  return {
    atlas: { cell, cells, height, margin, radius: RADIUS, width },
    data
  };
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { default: 'web/public/assets/emblems', type: 'string' }
    }
  });
  const out = values.out ?? 'web/public/assets/emblems';
  const svgs = readdirSync(EMBLEM_DIR)
    .filter(f => f.endsWith('.svg'))
    .sort()
    .map(f => ({
      name: basename(f, '.svg'),
      svg: readFileSync(join(EMBLEM_DIR, f), 'utf8')
    }));
  const { atlas, data } = buildEmblems(svgs);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'atlas.bin'), gzipSync(data));
  writeFileSync(join(out, 'atlas.json'), `${JSON.stringify(atlas)}\n`);
  console.log(
    `build-emblems: ${svgs.length} emblems, ${atlas.width}x${atlas.height} atlas in ${out}/`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
