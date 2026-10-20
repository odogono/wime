#!/usr/bin/env bun
// Run every extractor whose output is missing, so a fresh worktree is set up
// in one command and an existing one costs nothing.
//
//   bun tools/extract-all.ts [--force]
//
// --force reruns them all, after a change to an extractor or to
// docs/re/labels.md.
import { existsSync } from 'node:fs';

// Each script and a file it writes.
export const STEPS = [
  ['disasm', 'extracted_asm/code.asm'],
  ['extract-text', 'extracted_text/manifest.json'],
  ['extract-manual', 'extracted_text/manual.txt'],
  ['extract-graphics', 'extracted_graphics/manifest.json'],
  ['export:web', 'web/public/assets/starting-state.json']
] as const;

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const force = argv.includes('--force');
  for (const [script, output] of STEPS) {
    if (!force && existsSync(output)) {
      console.log(`${script}: ${output} exists, skipped`);
      continue;
    }
    const { exitCode } = Bun.spawnSync(['bun', 'run', script], {
      stdio: ['inherit', 'inherit', 'inherit']
    });
    if (exitCode !== 0) {
      return exitCode;
    }
  }
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
