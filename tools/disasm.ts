#!/usr/bin/env bun
// Disassemble the Reference Build's executable for reverse engineering.
//
//   bun tools/disasm.ts [ARCHIVE] [--out DIR]
//
// Writes DIR/code.asm (default extracted_asm/), one instruction per line,
// addressed as in docs/re/README.md. A `d(a4)` operand is annotated with the
// data offset it reaches, and addresses named in docs/re/labels.md are
// labelled, so `rg 'data\+0x1de8' extracted_asm/code.asm` finds every access
// to a table. A call through the jump table also names the routine it
// reaches (`; data+0x0252 jt_mulu32 -> code+0x1bb76 mulu32`). code.bin and data.bin hold the raw hunk contents.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import MCapstone, { type Capstone } from '@alexaltea/capstone-js';

import { DEFAULT_ARCHIVE, ExtractError } from './extract-graphics';
import { loadExecutable, parseHunkFile } from './extract-starting-state';

// The small-data model keeps A4 at data+0x7ffe (finding:executable-small-data-model).
export const A4_BIAS = 0x7f_fe;
export const LABELS_FILE = join(import.meta.dir, '../docs/re/labels.md');

export type Labels = Map<string, string>;

export type Instruction = {
  address: number;
  bytes: number[];
  mnemonic: string;
  operands: string;
};

export const codeAddress = (offset: number): string =>
  `code+0x${offset.toString(16).padStart(5, '0')}`;

export const dataAddress = (offset: number): string =>
  `data+0x${offset.toString(16).padStart(4, '0')}`;

// Read the `| \`code+0x…\` | \`name\` |` rows of labels.md.
export const parseLabels = (markdown: string): Labels => {
  const labels: Labels = new Map();
  for (const match of markdown.matchAll(
    /^\| `((?:code|data)\+0x[\da-f]+)` +\| `(\w+)`/gm
  )) {
    labels.set(match[1]!, match[2]!);
  }
  return labels;
};

// Data offset reached by each `d(a4)` operand.
export const a4Targets = (operands: string): number[] =>
  [...operands.matchAll(/(-?)\$([\da-f]+)\(a4\)/g)].map(
    ([, sign, hex]) => A4_BIAS + (sign ? -1 : 1) * Number.parseInt(hex!, 16)
  );

// Capstone.js throws, rather than returning nothing, when the first word is
// not an instruction.
const decodeFrom = (decoder: Capstone, code: Uint8Array, offset: number) => {
  try {
    return decoder.disasm([...code.subarray(offset)], offset);
  } catch {
    return [];
  }
};

export const disassembleCode = async (
  code: Uint8Array
): Promise<Instruction[]> => {
  const cs = await MCapstone();
  const decoder = new cs.Capstone(
    cs.ARCH_M68K,
    cs.MODE_M68K_000 | cs.MODE_BIG_ENDIAN
  );
  const instructions: Instruction[] = [];
  try {
    // Capstone stops at the first word it cannot decode, so resume after it.
    let offset = 0;
    while (offset < code.length) {
      const decoded = decodeFrom(decoder, code, offset);
      for (const instruction of decoded) {
        instructions.push({
          address: Number(instruction.address),
          bytes: [...instruction.bytes],
          mnemonic: instruction.mnemonic,
          operands: instruction.op_str.trim()
        });
      }
      const last = instructions.at(-1);
      const next = last ? last.address + last.bytes.length : 0;
      if (next > offset) {
        offset = next;
      } else {
        const word = [...code.subarray(offset, offset + 2)];
        instructions.push({
          address: offset,
          bytes: word,
          mnemonic: 'dc.w',
          operands: `$${word.map(byte => byte.toString(16).padStart(2, '0')).join('')}`
        });
        offset += word.length;
      }
    }
    return instructions;
  } finally {
    decoder.close();
  }
};

// The jump table at data+0x0000 is 100 `jmp abs.l` entries of 6 bytes, each
// holding the code offset it reaches before relocation. Maps each entry's
// data offset to that code offset.
export const jumpTargets = (data: Uint8Array): Map<number, number> => {
  const targets = new Map<number, number>();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let entry = 0; entry + 6 <= data.length; entry += 6) {
    if (view.getUint16(entry) !== 0x4e_f9) {
      break;
    }
    targets.set(entry, view.getUint32(entry + 2));
  }
  return targets;
};

export const formatListing = (
  instructions: Instruction[],
  labels: Labels,
  jumps: Map<number, number> = new Map()
): string => {
  const lines: string[] = [];
  for (const { address, bytes, mnemonic, operands } of instructions) {
    const label = labels.get(codeAddress(address));
    if (label) {
      lines.push('', `${label}:`);
    }
    const notes = a4Targets(operands).map(offset => {
      const target = dataAddress(offset);
      const name = labels.get(target);
      const note = name ? `${target} ${name}` : target;
      const jump = jumps.get(offset);
      if (jump === undefined) {
        return note;
      }
      const callee = codeAddress(jump);
      const calleeName = labels.get(callee);
      return `${note} -> ${callee}${calleeName ? ` ${calleeName}` : ''}`;
    });
    const hex = bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
    const text = `${mnemonic} ${operands}`.trim();
    lines.push(
      `${codeAddress(address)}  ${hex.padEnd(20)}  ${text}` +
        (notes.length ? `  ; ${notes.join(', ')}` : '')
    );
  }
  return `${lines.join('\n')}\n`;
};

export const main = async (
  argv: string[] = process.argv.slice(2)
): Promise<number> => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: { out: { default: 'extracted_asm', type: 'string' } }
  });
  const archive = positionals[0] ?? DEFAULT_ARCHIVE;
  const out = values.out ?? 'extracted_asm';
  const hunks = parseHunkFile(loadExecutable(archive));
  const code = hunks.find(hunk => hunk.type === 'code');
  const data = hunks.find(hunk => hunk.type === 'data');
  if (!code || !data) {
    throw new ExtractError('executable has no code or data hunk');
  }
  const instructions = await disassembleCode(code.data);
  const labels = parseLabels(readFileSync(LABELS_FILE, 'utf8'));
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'code.asm'),
    formatListing(instructions, labels, jumpTargets(data.data))
  );
  writeFileSync(join(out, 'code.bin'), code.data);
  writeFileSync(join(out, 'data.bin'), data.data);
  console.log(
    `disassembled ${instructions.length} instructions; wrote ${out}/code.asm, code.bin and data.bin`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(await main());
}
