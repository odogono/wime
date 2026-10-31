import { existsSync, readFileSync } from 'node:fs';

import type { MovementRule } from '../web/src/sim/crossing-movement';
import {
  hostFor,
  scenarioOf,
  setHostClock
} from '../web/src/sim/scripted/host';
import {
  SHUFFLED_SETUP_AXES,
  shuffleSetup
} from '../web/src/sim/shuffled-setup';
import { createSim, type SimState } from '../web/src/sim/state';
import { assetsFrom, step, type Assets } from './scripted-play';

export { step, type Assets } from './scripted-play';

setHostClock(() => performance.now());

// The differential test's harness (#194): the TypeScript sim and the
// scripted sim, played in lockstep from one seed and starting state, the
// view's part played the same way for both, compared after every step.

const asset = (path: string): URL =>
  new URL(`../web/public/assets/${path}`, import.meta.url);

const readJson = (path: URL): unknown => JSON.parse(readFileSync(path, 'utf8'));

// The exported assets, or null where they are absent, as in CI.
export const loadAssets = (): Assets | null => {
  const paths = {
    startingState: asset('starting-state.json'),
    terrain: asset('geography/terrain-regions.json'),
    waterways: asset('geography/waterways.json')
  };
  if (!Object.values(paths).every(path => existsSync(path))) {
    return null;
  }
  return assetsFrom({
    startingState: readJson(paths.startingState),
    terrain: readJson(paths.terrain),
    waterways: readJson(paths.waterways)
  });
};

export interface Game {
  movementRule: MovementRule;
  seed: number;
  // A Shuffled Setup's seed, or null for the Classic Setup.
  setupSeed: number | null;
}

export const startGame = (assets: Assets, game: Game): SimState =>
  createSim(
    game.seed,
    game.setupSeed === null
      ? assets.startingState
      : shuffleSetup(assets.startingState, game.setupSeed, SHUFFLED_SETUP_AXES),
    assets.terrain,
    { movementRule: game.movementRule, waterways: assets.waterways }
  );

// The state to compare: the core state, with the Crossing legs wherever
// each sim keeps them.
export const comparable = (sim: SimState): Record<string, unknown> => {
  const { crossingLegs: _legs, scenario: _scenario, ...core } = sim;
  return { ...core, crossingLegs: scenarioOf(sim).crossingLegs };
};

// The first path at which two plain values differ, or null.
export const firstDiff = (a: unknown, b: unknown, path = ''): string | null => {
  if (a === b) {
    return null;
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return `${path || '.'}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const diff = firstDiff(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`
    );
    if (diff) {
      return diff;
    }
  }
  return null;
};

export interface Divergence {
  // The first path that differs, and both values there.
  diff: string;
  step: number;
}

export interface Played {
  // Steps where the two sims chose different Crossings, each resynced
  // to the TypeScript sim's state so the run goes on (#194, decision Q8).
  crossingChoices: Divergence[];
  // The first divergence with the same Crossings chosen: a rule differs.
  divergence: Divergence | null;
  scripted: SimState;
  // Each scripted tick's host timing, in milliseconds.
  ticks: { convertMs: number; fuel: number; pumpMs: number; totalMs: number }[];
  typescript: SimState;
}

// The TypeScript sim's state as the scripted sim keeps it.
const asScripted = (sim: SimState): SimState => ({
  ...sim,
  crossingLegs: {},
  scenario: { crossingLegs: scenarioOf(sim).crossingLegs }
});

// Play both sims for `days` game days from the same state.
export const playBoth = (start: SimState, days: number): Played => {
  let typescript = start;
  let scripted = start;
  const lastDay = start.clock.day + days;
  const ticks: Played['ticks'] = [];
  const crossingChoices: Divergence[] = [];
  for (let n = 0; typescript.clock.day < lastDay && !typescript.ending; n++) {
    const ticking = !scripted.fight && !scripted.meeting && !scripted.council;
    typescript = step(typescript, 'typescript');
    const started = performance.now();
    scripted = step(scripted, 'scripted');
    if (ticking) {
      const { convertMs, fuel, pumpMs } = hostFor(scripted).last;
      ticks.push({
        convertMs,
        fuel,
        pumpMs,
        totalMs: performance.now() - started
      });
    }
    const expected = comparable(typescript);
    const got = comparable(scripted);
    const diff = firstDiff(expected, got);
    if (!diff) {
      continue;
    }
    const legs = firstDiff(
      expected.crossingLegs,
      got.crossingLegs,
      '.crossingLegs'
    );
    if (!legs) {
      return {
        crossingChoices,
        divergence: { diff, step: n },
        scripted,
        ticks,
        typescript
      };
    }
    crossingChoices.push({ diff: legs, step: n });
    scripted = asScripted(typescript);
  }
  return { crossingChoices, divergence: null, scripted, ticks, typescript };
};

// The exported text table, or null where it is absent.
export const loadTextTable = (): Record<string, string> | null => {
  const path = asset('text-table.json');
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>)
    : null;
};

const percentile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
};

// The full matrix: each Movement rule, Setup and seed for `days` days.
//
//   bun tools/scripted-differential.ts [days] [seeds] [setup seeds]
export const main = (argv: string[] = process.argv.slice(2)): number => {
  const assets = loadAssets();
  if (!assets) {
    console.error('The exported assets are missing: run bun run extract-all');
    return 1;
  }
  const days = Number(argv[0] ?? 30);
  const seeds = (argv[1] ?? '1,2,3').split(',').map(Number);
  const setupSeeds = [null, ...(argv[2] ?? '7,8').split(',').map(Number)];
  let failed = false;
  for (const movementRule of ['classic', 'crossing'] as const) {
    for (const setupSeed of setupSeeds) {
      for (const seed of seeds) {
        const played = playBoth(
          startGame(assets, { movementRule, seed, setupSeed }),
          days
        );
        const total = played.ticks.map(t => t.totalMs);
        const fuel = played.ticks.map(t => t.fuel);
        failed ||= played.divergence !== null;
        console.log(
          JSON.stringify({
            convertP50: +percentile(
              played.ticks.map(t => t.convertMs),
              0.5
            ).toFixed(2),
            crossingChoices: played.crossingChoices.length,
            divergence: played.divergence,
            ending: played.typescript.ending,
            fuelMax: Math.max(...fuel),
            fuelP50: percentile(fuel, 0.5),
            fuelP95: percentile(fuel, 0.95),
            lastDay: played.typescript.clock.day,
            movementRule,
            seed,
            setupSeed,
            tickMaxMs: +Math.max(...total).toFixed(2),
            tickP50Ms: +percentile(total, 0.5).toFixed(2),
            tickP95Ms: +percentile(total, 0.95).toFixed(2),
            ticks: total.length
          })
        );
      }
    }
  }
  return failed ? 1 : 0;
};

if (import.meta.main) {
  process.exit(main());
}
