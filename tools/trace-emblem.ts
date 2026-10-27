#!/usr/bin/env bun
// Trace a generated reference image into an Atlas Emblem
// (docs/spec/atlas-emblems.md, "Making an Emblem").
//
//   bun tools/trace-emblem.ts REFERENCE.png --shape banner|shield|charge
//     [--crop WxH+X+Y] [--mark PNG] [--mark-crop WxH+X+Y] [--out FILE]
//
// REFERENCE is a device in parchment on a coloured field, on a parchment
// background. The background is flooded to the field's colour, the
// parchment left is the device, and potrace traces it at a third of its
// size, which keeps the path small. A Unit's shield takes its Unit Type
// mark for the chief from --mark, or from --mark-crop of REFERENCE. The
// Emblem is fitted to the sheet's banner or shield, optimised by svgo and
// written to FILE (default: stdout). Needs ImageMagick and potrace on PATH
// (brew install imagemagick potrace).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { optimize } from 'svgo';

export type Shape = 'banner' | 'charge' | 'shield';

type Box = { height: number; width: number; x: number; y: number };

const INK = '#3a2c1c';
const PAPER = '#f0e4c4';
// The field is drawn in Good's colour; the renderer tints it per Side.
const FIELD = '#2f58a8';
const RIM = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;

// Each shape's outline and the boxes its device and mark are fitted to,
// in the Emblem's 64 × 64 viewBox.
const SHAPES: Record<
  Shape,
  { device: Box; mark?: Box; outline: string; rules: string }
> = {
  banner: {
    device: { height: 46, width: 26, x: 19, y: 9 },
    outline: 'M15 15 Q32 1 49 15 L49 51 L32 61 L15 51 Z',
    rules: ''
  },
  // A Nation's device or a Unit Type's mark alone, filling the box: the
  // map lays it on the Unit's shield (docs/spec/atlas-emblems.md).
  charge: {
    device: { height: 64, width: 64, x: 0, y: 0 },
    outline: '',
    rules: ''
  },
  shield: {
    device: { height: 26, width: 36, x: 14, y: 22 },
    mark: { height: 9, width: 20, x: 22, y: 9.5 },
    outline: 'M10 9 Q32 3 54 9 L54 30 Q54 49 32 61 Q10 49 10 30 Z',
    rules: `<path d="M11.5 20 L52.5 20" stroke="${INK}" stroke-width="2"/>`
  }
};

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
export const fitTrace = (traced: string, box: Box): string => {
  const viewBox = /viewBox="([^"]*)"/.exec(traced)?.[1];
  const group = /<g [\S\s]*<\/g>/.exec(traced)?.[0];
  if (!viewBox || !group) {
    throw new Error('not a potrace SVG');
  }
  const device = group.replace('fill="#000000"', `fill="${PAPER}"`);
  return `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${viewBox}">${device}</svg>`;
};

export const composeEmblem = (
  shape: Shape,
  device: string,
  mark?: string
): string => {
  const { device: deviceBox, mark: markBox, outline, rules } = SHAPES[shape];
  if (mark && !markBox) {
    throw new Error(`a ${shape} has no chief for a mark`);
  }
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">',
    outline ? `<path d="${outline}" fill="${FIELD}" ${RIM}/>` : '',
    rules,
    mark && markBox ? fitTrace(mark, markBox) : '',
    fitTrace(device, deviceBox),
    '</svg>'
  ].join('');
};

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
      mark: { type: 'string' },
      'mark-crop': { type: 'string' },
      out: { type: 'string' },
      shape: { type: 'string' }
    }
  });
  const reference = positionals[0];
  const shape = values.shape;
  if (
    !reference ||
    (shape !== 'banner' && shape !== 'charge' && shape !== 'shield')
  ) {
    console.error(
      'usage: bun tools/trace-emblem.ts REFERENCE.png --shape banner|shield|charge [--crop WxH+X+Y] [--mark PNG] [--mark-crop WxH+X+Y] [--out FILE]'
    );
    return 2;
  }
  const dir = mkdtempSync(join(tmpdir(), 'trace-emblem-'));
  try {
    const device = trace(dir, reference, values.crop);
    const markCrop = values['mark-crop'];
    const mark =
      values.mark || markCrop
        ? trace(dir, values.mark ?? reference, markCrop)
        : undefined;
    const svg = optimize(composeEmblem(shape, device, mark), {
      floatPrecision: 0,
      multipass: true
    }).data;
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
