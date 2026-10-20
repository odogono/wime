#!/usr/bin/env bun
// Print a slice of the disassembly, so a routine is read without dumping
// extracted_asm/code.asm.
//
//   bun tools/asm.ts ADDRESS|LABEL [LINES]
//
// ADDRESS is a code offset (`code+0x06b5c`, `0x6b5c` or `6b5c`) and need not
// start an instruction: the slice opens at the first instruction at or after
// it. LABEL is a name from docs/re/labels.md. LINES defaults to 60. Run
// `bun run disasm` first.
import { existsSync, readFileSync } from 'node:fs';

import { LABELS_FILE, parseLabels } from './disasm';

export const ASM_FILE = 'extracted_asm/code.asm';

// The code offset an argument names, or undefined.
export const resolveAddress = (
  arg: string,
  labels: Map<string, string>
): number | undefined => {
  for (const [address, name] of labels) {
    if (name === arg && address.startsWith('code+')) {
      return Number.parseInt(address.slice(5), 16);
    }
  }
  const hex = /^(?:code\+)?(?:0x)?([\da-f]+)$/i.exec(arg)?.[1];
  return hex === undefined ? undefined : Number.parseInt(hex, 16);
};

export const sliceListing = (
  listing: string,
  offset: number,
  count: number
): string[] => {
  const lines = listing.split('\n');
  const start = lines.findIndex(line => {
    const match = /^code\+0x([\da-f]{5})/.exec(line);
    return match !== null && Number.parseInt(match[1]!, 16) >= offset;
  });
  return start === -1 ? [] : lines.slice(start, start + count);
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const [arg, count = '60'] = argv;
  if (!arg) {
    console.error('usage: bun run asm ADDRESS|LABEL [LINES]');
    return 2;
  }
  if (!existsSync(ASM_FILE)) {
    console.error(`${ASM_FILE} is missing: run \`bun run disasm\` first`);
    return 1;
  }
  const labels = parseLabels(readFileSync(LABELS_FILE, 'utf8'));
  const offset = resolveAddress(arg, labels);
  if (offset === undefined) {
    console.error(`not a code address or label in docs/re/labels.md: ${arg}`);
    return 2;
  }
  const lines = sliceListing(
    readFileSync(ASM_FILE, 'utf8'),
    offset,
    Number(count)
  );
  console.log(lines.join('\n'));
  return lines.length > 0 ? 0 : 1;
};

if (import.meta.main) {
  process.exit(main());
}
