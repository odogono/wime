import type { MovementRule } from '../web/src/sim/crossing-movement';
import { startDemo, stepDemo, type DemoScript } from '../web/src/sim/demo';
import { orderedWay } from '../web/src/sim/movement';
import { hostFor } from '../web/src/sim/scripted/host';
import {
  isHeld,
  releaseWatched,
  setSimRules,
  tickSim,
  type SimState
} from '../web/src/sim/state';
import { step, type Assets } from './scripted-play';

// The scripted sim's speed mid-campaign (#194, step 5), under Bun or in a
// browser: a Demo plays on the TypeScript sim to `day`, as a Player keeps
// a game going, then each tick is timed on both sims from there, with the
// scripted host's conversion and Fuel split out, and the orderedWay Query
// is timed as a hover would ask it. The host's clock must be set.

const percentile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return +(sorted[Math.floor(q * (sorted.length - 1))] ?? 0).toFixed(3);
};

const summary = (values: number[]) => ({
  max: percentile(values, 1),
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95)
});

export interface MeasureOptions {
  count: number;
  day: number;
  hovers: number;
  movementRule: MovementRule;
}

export const measure = (
  assets: Assets,
  script: DemoScript,
  { count, day, hovers, movementRule }: MeasureOptions
) => {
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
        // On the Animation Level the view releases the watched
        // Character once its figures walk off, which runs the sweep on.
        const began = performance.now();
        state = isHeld(state) ? releaseWatched(state) : tickSim(state);
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
  const loading = performance.now();
  hostFor(start);
  const loadMs = performance.now() - loading;
  const typescript = time('typescript');
  const scripted = time('scripted');
  const hovered: number[] = [];
  setSimRules('scripted');
  try {
    for (let i = 0; i < hovers; i++) {
      const click = { x: 200 + ((i * 97) % 1700), y: 100 + ((i * 53) % 1100) };
      const began = performance.now();
      orderedWay(start, 7, click);
      hovered.push(performance.now() - began);
    }
  } finally {
    setSimRules('typescript');
  }
  return {
    day: start.clock.day,
    loadMs: +loadMs.toFixed(1),
    movementRule,
    orderedWayMs: summary(hovered),
    roster: start.roster.length,
    scripted: {
      convertMs: summary(scripted.converts),
      fuel: summary(scripted.fuels),
      tickMs: summary(scripted.totals)
    },
    ticks: scripted.totals.length,
    typescript: { tickMs: summary(typescript.totals) }
  };
};
