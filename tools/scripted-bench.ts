#!/usr/bin/env bun
// Times the scripted sim mid-campaign under Bun (#194): see
// scripted-measure.ts. scripted-browser.ts times it in Chromium.
//
//   bun tools/scripted-bench.ts [day] [ticks] [classic|crossing]
import { readFileSync } from 'node:fs';

import type { DemoScript } from '../web/src/sim/demo';
import { loadAssets } from './scripted-differential';
import { measure } from './scripted-measure';

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const assets = loadAssets();
  if (!assets) {
    console.error('The exported assets are missing: run bun run extract-all');
    return 1;
  }
  const script = JSON.parse(
    readFileSync(
      new URL('../web/public/demos/fellowship.json', import.meta.url),
      'utf8'
    )
  ) as DemoScript;
  const result = measure(assets, script, {
    count: Number(argv[1] ?? 500),
    day: Number(argv[0] ?? 100),
    hovers: 200,
    movementRule: argv[2] === 'classic' ? 'classic' : 'crossing'
  });
  console.log(JSON.stringify(result, null, 2));
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
