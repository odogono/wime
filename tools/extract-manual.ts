#!/usr/bin/env bun
// Extract the original instruction manual (cited as `manual` in specs).
//
//   bun tools/extract-manual.ts [PDF] [--out DIR]
//
// PDF defaults to artifacts/WarinMiddleEarth-InstructionManual.pdf. Writes
// DIR/manual.txt (default extracted_text/), the scan's own text layer with a
// `--- page N ---` line before each page, and DIR/manual/page-NN.png at
// 100 dpi. The text layer is noisy OCR ("Ifyou", "Ores" for "Orcs"): search
// manual.txt, then read the page image to quote it.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { ARTIFACTS_DIR, ExtractError } from './extract-graphics';

export const DEFAULT_MANUAL = join(
  ARTIFACTS_DIR,
  'WarinMiddleEarth-InstructionManual.pdf'
);

const poppler = (command: string, args: string[]): string => {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      throw new ExtractError(
        `${command} is required on PATH (brew install poppler)`
      );
    }
    throw new ExtractError(`${command} failed on ${args.at(-2) ?? ''}`);
  }
};

// pdftotext separates pages with a form feed.
export const markPages = (text: string): string =>
  text
    .split('\f')
    .slice(0, text.endsWith('\f') ? -1 : undefined)
    .map((page, index) => `--- page ${index + 1} ---\n${page.trimEnd()}\n`)
    .join('\n');

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: { out: { default: 'extracted_text', type: 'string' } }
  });
  const pdf = positionals[0] ?? DEFAULT_MANUAL;
  const out = values.out ?? 'extracted_text';
  const pages = join(out, 'manual');
  mkdirSync(pages, { recursive: true });
  const text = markPages(poppler('pdftotext', [pdf, '-']));
  writeFileSync(join(out, 'manual.txt'), text);
  poppler('pdftoppm', ['-r', '100', '-png', pdf, join(pages, 'page')]);
  console.log(`wrote ${out}/manual.txt and page images to ${pages}/`);
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
