#!/usr/bin/env bun
// Read the disassembly without dumping extracted_asm/code.asm.
//
//   bun tools/asm.ts ADDRESS|LABEL [LINES] [--before N]
//   bun tools/asm.ts --routine ADDRESS|LABEL
//   bun tools/asm.ts --refs ADDRESS|LABEL
//
// ADDRESS is a code offset (`code+0x06b5c`, `0x6b5c` or `6b5c`) and need not
// start an instruction: the slice opens at the first instruction at or after
// it, LINES (default 60) long, after N lines before it. LABEL is a name from
// docs/re/labels.md.
//
// --routine prints the whole routine holding the address. A routine opens at
// a label, a `link` or the target of a call, and runs to the next.
//
// --refs lists every instruction that calls a code address, directly or
// through the jump table, or reaches a data address (`data+0x1de8` or a data
// label) through A4, each with the routine it sits in. Run `bun run disasm`
// first.
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { LABELS_FILE, codeAddress, dataAddress, parseLabels } from './disasm';

export const ASM_FILE = 'extracted_asm/code.asm';

export type Target = { hunk: 'code' | 'data'; offset: number };

// The address an argument names, or undefined. A bare number is a code
// offset.
export const resolveTarget = (
  arg: string,
  labels: Map<string, string>
): Target | undefined => {
  for (const [address, name] of labels) {
    if (name === arg) {
      const [hunk, hex] = address.split('+0x') as ['code' | 'data', string];
      return { hunk, offset: Number.parseInt(hex, 16) };
    }
  }
  const match = /^(?:(code|data)\+)?(?:0x)?([\da-f]+)$/i.exec(arg);
  if (!match) {
    return undefined;
  }
  const hunk = match[1] === 'data' ? 'data' : 'code';
  return { hunk, offset: Number.parseInt(match[2]!, 16) };
};

// The code offset an argument names, or undefined.
export const resolveAddress = (
  arg: string,
  labels: Map<string, string>
): number | undefined => {
  const target = resolveTarget(arg, labels);
  return target?.hunk === 'code' ? target.offset : undefined;
};

type Line = { offset: number; text: string };

// The listing's instructions, without its blank and label lines.
const instructions = (listing: string): Line[] =>
  listing.split('\n').flatMap(text => {
    const match = /^code\+0x([\da-f]{5})/.exec(text);
    return match ? [{ offset: Number.parseInt(match[1]!, 16), text }] : [];
  });

const firstAtOrAfter = (lines: Line[], offset: number): number =>
  lines.findIndex(line => line.offset >= offset);

export const sliceListing = (
  listing: string,
  offset: number,
  count: number,
  before = 0
): string[] => {
  const lines = instructions(listing);
  const start = firstAtOrAfter(lines, offset);
  if (start === -1) {
    return [];
  }
  return lines
    .slice(Math.max(0, start - before), start + count)
    .map(line => line.text);
};

// Offsets where a routine opens: labels, `link`s and call targets.
export const routineStarts = (listing: string): number[] => {
  const starts = new Set<number>();
  const rows = listing.split('\n');
  rows.forEach((text, index) => {
    if (/^\w+:$/.test(text)) {
      const next = /^code\+0x([\da-f]{5})/.exec(rows[index + 1] ?? '');
      if (next) {
        starts.add(Number.parseInt(next[1]!, 16));
      }
    }
    const link = /^code\+0x([\da-f]{5}) +\S+ +link/.exec(text);
    if (link) {
      starts.add(Number.parseInt(link[1]!, 16));
    }
    for (const call of text.matchAll(/-> code\+0x([\da-f]{5})/g)) {
      starts.add(Number.parseInt(call[1]!, 16));
    }
  });
  return [...starts].sort((a, b) => a - b);
};

// The routine holding an offset: where it opens and where the next opens.
export const routineAround = (
  starts: number[],
  offset: number
): { end: number; start: number } => {
  const index = starts.findLastIndex(start => start <= offset);
  return {
    end: starts[index + 1] ?? Number.POSITIVE_INFINITY,
    start: index === -1 ? 0 : starts[index]!
  };
};

export const routineListing = (listing: string, offset: number): string[] => {
  const { end, start } = routineAround(routineStarts(listing), offset);
  return instructions(listing)
    .filter(line => line.offset >= start && line.offset < end)
    .map(line => line.text);
};

// Each instruction whose note reaches the target, tagged with its routine.
export const refsTo = (
  listing: string,
  target: Target,
  labels: Map<string, string>
): string[] => {
  const address =
    target.hunk === 'code'
      ? codeAddress(target.offset)
      : dataAddress(target.offset);
  const starts = routineStarts(listing);
  return instructions(listing)
    .filter(line => {
      const note = line.text.split(';')[1] ?? '';
      return new RegExp(
        String.raw`${address.replace('+', String.raw`\+`)}\b`
      ).test(note);
    })
    .map(line => {
      const start = codeAddress(routineAround(starts, line.offset).start);
      const name = labels.get(start);
      return `${line.text}  [in ${start}${name ? ` ${name}` : ''}]`;
    });
};

const USAGE = [
  'usage: bun run asm ADDRESS|LABEL [LINES] [--before N]',
  '       bun run asm --routine ADDRESS|LABEL',
  '       bun run asm --refs ADDRESS|LABEL'
].join('\n');

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      before: { default: '0', type: 'string' },
      refs: { type: 'boolean' },
      routine: { type: 'boolean' }
    }
  });
  const [arg, count = '60'] = positionals;
  if (!arg) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(ASM_FILE)) {
    console.error(`${ASM_FILE} is missing: run \`bun run disasm\` first`);
    return 1;
  }
  const labels = parseLabels(readFileSync(LABELS_FILE, 'utf8'));
  const target = resolveTarget(arg, labels);
  if (target === undefined || (target.hunk === 'data' && !values.refs)) {
    console.error(
      `not a ${values.refs ? '' : 'code '}address or label in docs/re/labels.md: ${arg}`
    );
    return 2;
  }
  const listing = readFileSync(ASM_FILE, 'utf8');
  const lines = values.refs
    ? refsTo(listing, target, labels)
    : values.routine
      ? routineListing(listing, target.offset)
      : sliceListing(
          listing,
          target.offset,
          Number(count),
          Number(values.before)
        );
  console.log(lines.join('\n'));
  return lines.length > 0 ? 0 : 1;
};

if (import.meta.main) {
  process.exit(main());
}
