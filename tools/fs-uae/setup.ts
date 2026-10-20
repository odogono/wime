#!/usr/bin/env bun
// Build the FS-UAE boot drive for the Reference Build in build/fs-uae/
// (gitignored), as docs/re/fs-uae.md describes.
//
//   bun tools/fs-uae/setup.ts [--force]
//
// DH0 is the WHDLoad install extracted from the archive, plus WHDLoad and
// the Kickstart 1.3 image WHDLoad needs, taken from FS-UAE's own directory
// (FS_UAE_DIR, default ~/games/amiga/FS-UAE). Writes wime.fs-uae next to it.
// --force rebuilds an existing drive.
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { DEFAULT_ARCHIVE } from '../extract-graphics';

export const BUILD_DIR = resolve(import.meta.dir, '../../build/fs-uae');

export const fsUaeDir =
  process.env.FS_UAE_DIR ?? join(homedir(), 'games/amiga/FS-UAE');

// FS-UAE's download cache names files by SHA-1.
const WHDLOAD = 'Cache/Downloads/d6b/d6b706bfbfe637bd98cd657114eea630b7d2dcc7';
const KICK13_RTB =
  'Cache/Downloads/209/209c109855f94c935439b60950d049527d2f2484';
export const KICK13 =
  'Kickstarts/Kickstart-v1.3-rev34.5-1987-Commodore-A500-A1000-A2000-CDTV.rom';
const KICK204 =
  'Kickstarts/Kickstart-v2.04-rev37.175-1991-Commodore-A500plus.rom';

export const config = (dh0: string, kickstart: string): string =>
  [
    '[fs-uae]',
    'amiga_model = A500+',
    `kickstart_file = ${kickstart}`,
    'chip_memory = 1024',
    'fast_memory = 4096',
    `hard_drive_0 = ${dh0}`,
    'console_debugger = 1',
    'window_width = 1440',
    'window_height = 1080',
    'automatic_input_grab = 0',
    ''
  ].join('\n');

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const dh0 = join(BUILD_DIR, 'dh0');
  if (existsSync(join(dh0, 'WarInMiddleEarth')) && !argv.includes('--force')) {
    console.log(`${dh0} exists; pass --force to rebuild it`);
    return 0;
  }
  for (const file of [WHDLOAD, KICK13_RTB, KICK13, KICK204]) {
    if (!existsSync(join(fsUaeDir, file))) {
      console.error(`missing ${join(fsUaeDir, file)} (set FS_UAE_DIR)`);
      return 1;
    }
  }
  rmSync(dh0, { force: true, recursive: true });
  mkdirSync(join(dh0, 'C'), { recursive: true });
  mkdirSync(join(dh0, 'S'));
  mkdirSync(join(dh0, 'Devs/Kickstarts'), { recursive: true });
  execFileSync('lha', [`-xw=${dh0}`, DEFAULT_ARCHIVE], { stdio: 'ignore' });
  copyFileSync(join(fsUaeDir, WHDLOAD), join(dh0, 'C/WHDLoad'));
  copyFileSync(
    join(fsUaeDir, KICK13),
    join(dh0, 'Devs/Kickstarts/kick34005.A500')
  );
  copyFileSync(
    join(fsUaeDir, KICK13_RTB),
    join(dh0, 'Devs/Kickstarts/kick34005.A500.RTB')
  );
  writeFileSync(
    join(dh0, 'S/Startup-Sequence'),
    'cd DH0:WarInMiddleEarth\nWHDLoad WarInMiddleEarth.Slave PRELOAD\n'
  );
  writeFileSync(
    join(BUILD_DIR, 'wime.fs-uae'),
    config(dh0, join(fsUaeDir, KICK204))
  );
  writeFileSync(join(BUILD_DIR, 'debugger.in'), '');
  console.log(`wrote ${dh0} and ${join(BUILD_DIR, 'wime.fs-uae')}`);
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
