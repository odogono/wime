#!/usr/bin/env bun
// Resolve the text IDs the Scenario Scripts name into the text table the
// text Engine Primitive reads (#194). A text ID is where the text lies in
// the Reference Build; this resolves `code+0x…` IDs, NUL-terminated
// Latin-1 strings in the code hunk the disassembler extracts.
//
//   bun tools/export-text-table.ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { WEB_ASSETS_DIR } from './export-web';
import { stringifySortedJson } from './extract-graphics';

const SCRIPTS_DIR = 'web/src/sim/scripted/shipped-game';
const CODE_BIN = 'extracted_asm/code.bin';
const OUTPUT = join(WEB_ASSETS_DIR, 'text-table.json');

const TEXT_ID = /"(code\+0x[\da-f]{5})"/g;

// Every text ID a Scenario Script names, sorted.
export const textIdsIn = (sources: string[]): string[] =>
  [
    ...new Set(
      sources.flatMap(source => [...source.matchAll(TEXT_ID)].map(m => m[1]!))
    )
  ].sort();

// The NUL-terminated Latin-1 string at a code offset.
export const codeText = (code: Uint8Array, id: string): string => {
  const offset = Number.parseInt(id.slice('code+'.length), 16);
  const end = code.indexOf(0, offset);
  if (offset >= code.length || end === -1) {
    throw new Error(`No text at ${id}`);
  }
  return new TextDecoder('latin1').decode(code.subarray(offset, end));
};

export const main = (): number => {
  if (!existsSync(CODE_BIN)) {
    console.error(`${CODE_BIN} is missing: run bun run disasm`);
    return 1;
  }
  const code = readFileSync(CODE_BIN);
  const sources = readdirSync(SCRIPTS_DIR)
    .filter(name => name.endsWith('.ts'))
    .map(name => readFileSync(join(SCRIPTS_DIR, name), 'utf8'));
  const table = Object.fromEntries(
    textIdsIn(sources).map(id => [id, codeText(code, id)])
  );
  Bun.write(OUTPUT, stringifySortedJson(table));
  console.log(
    `export-text-table: ${Object.keys(table).length} texts in ${OUTPUT}`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
