#!/usr/bin/env bun
// Trace a generated reference image into an Atlas Emblem
// (docs/spec/atlas-emblems.md, "Making an Emblem").
//
//   bun tools/trace-emblem.ts REFERENCE.png --shape banner|charge|mark
//     [--upright] [--crop WxH+X+Y] [--out FILE]
//
// REFERENCE is a device in parchment on a coloured field, on a parchment
// background. The background is flooded to the field's colour, the
// parchment left is the device, and potrace traces it at a third of its
// size, which keeps the path small. The device is fitted to the sheet's
// banner, alone as a Nation's charge, or as a Unit Type's mark: rimmed in
// ink and laid point up and to the right, or kept --upright. The Emblem is
// optimised by svgo and written to FILE (default: stdout). Needs
// ImageMagick and potrace on PATH (brew install imagemagick potrace).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { optimize } from 'svgo';

export type Shape = 'banner' | 'charge' | 'mark';

type Box = { height: number; width: number; x: number; y: number };

const INK = '#3a2c1c';
const PAPER = '#f0e4c4';
// The field is drawn in Good's colour; the renderer tints it per Side.
const FIELD = '#2f58a8';
const RIM = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;

// The banner's outline and the box its device is fitted to, in the
// Emblem's 64 × 64 viewBox.
const BANNER = {
  device: { height: 46, width: 26, x: 19, y: 9 },
  outline: 'M15 15 Q32 1 49 15 L49 51 L32 61 L15 51 Z'
};
// A mark's length, in units, and its ink rim's: half the stroke shows
// outside the parchment.
const MARK_LENGTH = 58;
const MARK_RIM = 5;

const run = (command: string, args: string[]): void => {
  try {
    execFileSync(command, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      throw new Error(
        `${command} is required on PATH (brew install imagemagick potrace)`
      );
    }
    throw new Error(`${command} failed`);
  }
};

// A potrace SVG's device, as a nested <svg> fitted into a box.
export const fitTrace = (traced: string, box: Box, rim = ''): string => {
  const viewBox = /viewBox="([^"]*)"/.exec(traced)?.[1];
  const group = /<g [\S\s]*<\/g>/.exec(traced)?.[0];
  if (!viewBox || !group) {
    throw new Error('not a potrace SVG');
  }
  const device = group.replace('fill="#000000"', `fill="${PAPER}"${rim}`);
  const overflow = rim ? ' overflow="visible"' : '';
  return `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${viewBox}"${overflow}>${device}</svg>`;
};

// A Unit Type's mark (docs/spec/atlas-emblems.md): MARK_LENGTH long and
// rimmed in ink, so it reads where it crosses the device or overhangs the
// shield. A weapon is drawn point left and laid point up and to the right,
// as the original's are.
const fitMark = (traced: string, upright: boolean): string => {
  const [, , width = 1, height = 1] =
    /viewBox="([^"]*)"/.exec(traced)?.[1]?.split(' ').map(Number) ?? [];
  const scale = MARK_LENGTH / Math.max(width, height);
  const [w, h] = [width * scale, height * scale];
  const rim = ` stroke="${INK}" stroke-width="${(MARK_RIM / scale).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"`;
  const box = { height: h, width: w, x: 32 - w / 2, y: 32 - h / 2 };
  const mark = fitTrace(traced, box, rim);
  return upright ? mark : `<g transform="rotate(135 32 32)">${mark}</g>`;
};

export const composeEmblem = (
  shape: Shape,
  device: string,
  upright = false
): string =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">',
    shape === 'banner'
      ? `<path d="${BANNER.outline}" fill="${FIELD}" ${RIM}/>${fitTrace(device, BANNER.device)}`
      : shape === 'mark'
        ? fitMark(device, upright)
        : fitTrace(device, { height: 64, width: 64, x: 0, y: 0 }),
    '</svg>'
  ].join('');

// svgo, kept from dropping a mark's paint order, which SVG 1.1 lacks, or
// moving its turn onto the nested <svg>, which cannot carry one.
export const optimizeEmblem = (svg: string): string =>
  optimize(svg, {
    floatPrecision: 0,
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: { collapseGroups: false, removeUnknownsAndDefaults: false }
        }
      }
    ]
  }).data;

const trace = (dir: string, png: string, crop?: string): string => {
  const name = join(dir, `trace-${Math.random().toString(36).slice(2)}`);
  // Flood the background from each corner, then keep the parchment.
  const corners = ['0,0', '%[fx:w-1],0', '0,%[fx:h-1]', '%[fx:w-1],%[fx:h-1]'];
  run('magick', [
    png,
    '-fuzz',
    '12%',
    '-fill',
    FIELD,
    ...corners.flatMap(at => ['-draw', `color ${at} floodfill`]),
    ...(crop ? ['-crop', crop, '+repage'] : []),
    '-colorspace',
    'gray',
    '-threshold',
    '70%',
    '-negate',
    `${name}-full.pbm`
  ]);
  // Tracing a third of the size keeps the path small. The shrink must
  // read the bilevel file: shrinking in the same pass loses fine detail.
  run('magick', [
    `${name}-full.pbm`,
    '-resize',
    '33%',
    '-threshold',
    '50%',
    `${name}.pbm`
  ]);
  run('potrace', [
    '-s',
    '--tight',
    '-t',
    '10',
    '-a',
    '1.2',
    '-O',
    '1',
    `${name}.pbm`,
    '-o',
    `${name}.svg`
  ]);
  return readFileSync(`${name}.svg`, 'utf8');
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      crop: { type: 'string' },
      out: { type: 'string' },
      shape: { type: 'string' },
      upright: { type: 'boolean' }
    }
  });
  const reference = positionals[0];
  const shape = values.shape;
  if (
    !reference ||
    (shape !== 'banner' && shape !== 'charge' && shape !== 'mark')
  ) {
    console.error(
      'usage: bun tools/trace-emblem.ts REFERENCE.png --shape banner|charge|mark [--upright] [--crop WxH+X+Y] [--out FILE]'
    );
    return 2;
  }
  const dir = mkdtempSync(join(tmpdir(), 'trace-emblem-'));
  try {
    const device = trace(dir, reference, values.crop);
    const svg = optimizeEmblem(composeEmblem(shape, device, values.upright));
    if (values.out) {
      writeFileSync(values.out, `${svg}\n`);
    } else {
      console.log(svg);
    }
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
