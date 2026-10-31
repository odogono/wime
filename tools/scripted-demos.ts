#!/usr/bin/env bun
// The Demo check (#194): each Demo plays to its end on the TypeScript sim
// and the scripted sim in lockstep, compared after every step. A step
// where the two chose different Crossings is counted and the scripted
// run resynced, as in the differential test.
//
//   bun tools/scripted-demos.ts [fellowship,muster,defensive]
import { existsSync, readFileSync } from 'node:fs';

import {
  campaignOver,
  startDemo,
  stepDemo,
  type DemoRun,
  type DemoScript
} from '../web/src/sim/demo';
import { setSimRules, type SimRules } from '../web/src/sim/state';
import {
  comparable,
  firstDiff,
  loadAssets,
  type Divergence
} from './scripted-differential';

const DAY_CAP = 400;

const stepWith = (run: DemoRun, rules: SimRules): DemoRun => {
  setSimRules(rules);
  try {
    return stepDemo(run);
  } finally {
    setSimRules('typescript');
  }
};

export interface DemoPlayed {
  crossingChoices: Divergence[];
  divergence: Divergence | null;
  ending: string | null;
  lastDay: number;
  steps: number;
}

export const playDemoBoth = (
  script: DemoScript,
  assets: NonNullable<ReturnType<typeof loadAssets>>
): DemoPlayed => {
  let typescript = startDemo(script, assets);
  let scripted = typescript;
  const crossingChoices: Divergence[] = [];
  let steps = 0;
  while (!campaignOver(typescript, DAY_CAP)) {
    typescript = stepWith(typescript, 'typescript');
    scripted = stepWith(scripted, 'scripted');
    steps++;
    const expected = comparable(typescript.state);
    const got = comparable(scripted.state);
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
        divergence: { diff, step: steps },
        ending: typescript.state.ending,
        lastDay: typescript.state.clock.day,
        steps
      };
    }
    crossingChoices.push({ diff: legs, step: steps });
    scripted = {
      ...typescript,
      state: {
        ...typescript.state,
        crossingLegs: {},
        scenario: { crossingLegs: typescript.state.crossingLegs }
      }
    };
  }
  return {
    crossingChoices,
    divergence: null,
    ending: typescript.state.ending,
    lastDay: typescript.state.clock.day,
    steps
  };
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const assets = loadAssets();
  if (!assets) {
    console.error('The exported assets are missing: run bun run extract-all');
    return 1;
  }
  let failed = false;
  for (const plan of (argv[0] ?? 'fellowship,muster,defensive').split(',')) {
    const path = new URL(`../web/public/demos/${plan}.json`, import.meta.url);
    if (!existsSync(path)) {
      console.error(`No Demo ${plan}`);
      return 1;
    }
    const script = JSON.parse(readFileSync(path, 'utf8')) as DemoScript;
    const played = playDemoBoth(script, assets);
    failed ||= played.divergence !== null;
    console.log(
      JSON.stringify({
        crossingChoices: played.crossingChoices.length,
        divergence: played.divergence,
        ending: played.ending,
        lastDay: played.lastDay,
        movementRule: script.movementRule,
        plan,
        steps: played.steps
      })
    );
  }
  return failed ? 1 : 0;
};

if (import.meta.main) {
  process.exit(main());
}
