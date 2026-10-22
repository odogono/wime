#!/usr/bin/env bun
// Decode the Animation Level's figure scripts from the data hunk
// (finding:graphics-figure-animation-scripts), as the interpreter at
// code+0x0bf84 reads them.
//
//   bun tools/figure-script.ts FRML [ENTRY]
//
// Prints FRML's script, one `offset: byte op arg` line a step, from ENTRY
// (hex, default 0) to the end of its 252 bytes. Run `bun run disasm` first:
// it reads extracted_asm/data.bin.
import { existsSync, readFileSync } from 'node:fs';

export const DATA_FILE = 'extracted_asm/data.bin';
// figureScripts: one 252-byte script per FRML figure set.
export const SCRIPTS = 0x09_5e;
export const SCRIPT_LENGTH = 0xfc;
export const SCRIPT_COUNT = 20;

const OPS = [
  'frame',
  'left',
  'right',
  'wait',
  'event',
  'jump',
  'speed',
  'face'
];

// Each byte's top 3 bits are the op and its low 5 bits the argument. A
// jump takes the next byte as its target; argument bit 0 makes it a call
// and 0x1f is a return.
export const decodeScript = (script: Uint8Array, entry = 0): string[] => {
  const lines: string[] = [];
  for (let at = entry; at < script.length; at += 1) {
    const byte = script[at]!;
    const op = byte >> 5;
    const arg = byte & 0x1f;
    const head = `${hex(at)}: ${hex(byte)}`;
    if (op === 5 && arg === 0x1f) {
      lines.push(`${head} return`);
    } else if (op === 5) {
      const target = script[at + 1] ?? 0;
      const kind = arg & 1 ? 'call' : 'jump';
      lines.push(`${head} ${kind} if ${hex(arg & 0x1e)} -> ${hex(target)}`);
      at += 1;
    } else {
      lines.push(`${head} ${OPS[op]} ${hex(arg)}`);
    }
  }
  return lines;
};

const hex = (value: number): string => value.toString(16).padStart(2, '0');

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const [frml, entry = '0'] = argv;
  const index = Number(frml);
  if (frml === undefined || !(index >= 0 && index < SCRIPT_COUNT)) {
    console.error(
      `usage: bun run figure-script FRML(0-${SCRIPT_COUNT - 1}) [ENTRY]`
    );
    return 2;
  }
  if (!existsSync(DATA_FILE)) {
    console.error(`${DATA_FILE} is missing: run \`bun run disasm\` first`);
    return 1;
  }
  const data = readFileSync(DATA_FILE);
  const start = SCRIPTS + index * SCRIPT_LENGTH;
  const script = data.subarray(start, start + SCRIPT_LENGTH);
  console.log(decodeScript(script, Number.parseInt(entry, 16)).join('\n'));
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
