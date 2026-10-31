#!/usr/bin/env bun
// Times the scripted sim mid-campaign under Bun (#194): the TypeScript sim
// plays to `day`, then each tick is timed on both sims from there, with the
// scripted host's conversion and pump split out, and the orderedWay Query
// is timed as a hover would ask it. The browser numbers are the spike's
// second part.
//
//   bun tools/scripted-bench.ts [day] [ticks] [classic|crossing]
import { readFileSync } from 'node:fs';

import { startDemo, stepDemo, type DemoScript } from '../web/src/sim/demo';
import { orderedWay } from '../web/src/sim/movement';
import { hostFor } from '../web/src/sim/scripted/host';
import { setSimRules, tickSim, type SimState } from '../web/src/sim/state';
import { loadAssets, step } from './scripted-differential';

const percentile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return +(sorted[Math.floor(q * (sorted.length - 1))] ?? 0).toFixed(3);
};

const summary = (values: number[]) => ({
  max: percentile(values, 1),
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95)
});

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const assets = loadAssets();
  if (!assets) {
    console.error('The exported assets are missing: run bun run extract-all');
    return 1;
  }
  const day = Number(argv[0] ?? 100);
  const count = Number(argv[1] ?? 500);
  const movementRule = argv[2] === 'classic' ? 'classic' : 'crossing';
  // A Demo's Player keeps the game going, as a game left alone does not.
  const script = JSON.parse(
    readFileSync(
      new URL('../web/public/demos/fellowship.json', import.meta.url),
      'utf8'
    )
  ) as DemoScript;
  let run = startDemo({ ...script, movementRule }, assets);
  while (run.state.clock.day < day && !run.state.ending) {
    run = stepDemo(run);
  }
  const start: SimState = run.state;
  const time = (rules: 'scripted' | 'typescript') => {
    const totals: number[] = [];
    const converts: number[] = [];
    const fuels: number[] = [];
    let state = start;
    setSimRules(rules);
    try {
      for (let i = 0; i < count; i++) {
        if (state.fight || state.meeting || state.council || state.ending) {
          state = step(state, rules);
          continue;
        }
        const began = performance.now();
        state = tickSim(state);
        totals.push(performance.now() - began);
        if (rules === 'scripted') {
          converts.push(hostFor(state).last.convertMs);
          fuels.push(hostFor(state).last.fuel);
        }
      }
    } finally {
      setSimRules('typescript');
    }
    return { converts, fuels, totals };
  };
  // A first scripted tick compiles and loads the Scenario Scripts.
  hostFor(start);
  const typescript = time('typescript');
  const scripted = time('scripted');
  const hovers: number[] = [];
  setSimRules('scripted');
  try {
    for (let i = 0; i < 200; i++) {
      const click = { x: 200 + ((i * 97) % 1700), y: 100 + ((i * 53) % 1100) };
      const began = performance.now();
      orderedWay(start, 7, click);
      hovers.push(performance.now() - began);
    }
  } finally {
    setSimRules('typescript');
  }
  console.log(
    JSON.stringify(
      {
        day: start.clock.day,
        movementRule,
        orderedWayMs: summary(hovers),
        roster: start.roster.length,
        scripted: {
          convertMs: summary(scripted.converts),
          fuel: summary(scripted.fuels),
          tickMs: summary(scripted.totals)
        },
        ticks: scripted.totals.length,
        typescript: { tickMs: summary(typescript.totals) }
      },
      null,
      2
    )
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
