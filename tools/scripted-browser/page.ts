import type { DemoScript } from '../../web/src/sim/demo';
import {
  setHostClock,
  setScriptCore,
  setTextTable
} from '../../web/src/sim/scripted/host';
import { createWasmCore } from '../../web/src/sim/scripted/wasm-core';
import { measure } from '../scripted-measure';
import { assetsFrom } from '../scripted-play';

// The browser page scripted-browser.ts drives (#194, step 5): it measures
// the scripted sim on the Core named in ?core=, ts or wasm, under both
// Movement rules, and leaves the figures in globalThis.results.

const json = async (path: string): Promise<unknown> =>
  (await fetch(path)).json();

const run = async (): Promise<unknown> => {
  try {
    return await measureHere();
  } catch (error) {
    return {
      error: error instanceof Error ? (error.stack ?? error.message) : error
    };
  }
};

const measureHere = async () => {
  const params = new URLSearchParams(location.search);
  const core = params.get('core') === 'wasm' ? 'wasm' : 'ts';
  const day = Number(params.get('day') ?? 100);
  const count = Number(params.get('ticks') ?? 500);
  const [startingState, terrain, waterways, texts, script] = await Promise.all([
    json('/assets/starting-state.json'),
    json('/assets/geography/terrain-regions.json'),
    json('/assets/geography/waterways.json'),
    json('/assets/text-table.json'),
    json('/demos/fellowship.json')
  ]);
  setHostClock(() => performance.now());
  setTextTable(texts as Record<string, string>);
  let compileMs = 0;
  if (core === 'wasm') {
    const began = performance.now();
    setScriptCore(
      await createWasmCore({ wasm: new URL('/talk.wasm', location.href) })
    );
    compileMs = +(performance.now() - began).toFixed(1);
  }
  const assets = assetsFrom({ startingState, terrain, waterways });
  const runs = (['crossing', 'classic'] as const).map(movementRule =>
    measure(assets, script as DemoScript, {
      count,
      day,
      hovers: 200,
      movementRule
    })
  );
  return { compileMs, core, runs, userAgent: navigator.userAgent };
};

(globalThis as { results?: Promise<unknown> }).results = run();
