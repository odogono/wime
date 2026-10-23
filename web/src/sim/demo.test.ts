import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
  campaignOver,
  replayDemo,
  sameClock,
  startDemo,
  stepDemo,
  type DemoAssets,
  type DemoPlan,
  type DemoScript
} from './demo';

const PUBLIC = new URL('../../public/', import.meta.url).pathname;
const STARTING_STATE = `${PUBLIC}assets/starting-state.json`;
const TILEMAP = `${PUBLIC}assets/campaign/tilemap.json`;
const PLANS: DemoPlan[] = ['fellowship', 'muster', 'defensive'];

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

// Called only inside the skipped block, so CI never reads the assets.
const assets = (): DemoAssets => ({
  startingState: readJson(STARTING_STATE),
  tilemap: readJson(TILEMAP) as DemoAssets['tilemap']
});

describe.skipIf(!existsSync(STARTING_STATE) || !existsSync(TILEMAP))(
  'the step-wise Demo driver',
  () => {
    for (const plan of PLANS) {
      test(`stepping the ${plan} Demo to its end matches the whole replay`, () => {
        const loaded = assets();
        const script = readJson(`${PUBLIC}demos/${plan}.json`) as DemoScript;
        let run = startDemo(script, loaded);
        let clockMoves = 0;
        while (!campaignOver(run, 400)) {
          const before = run.state.clock;
          run = stepDemo(run);
          if (!sameClock(before, run.state.clock)) {
            clockMoves++;
          }
        }
        const whole = replayDemo(script, loaded);
        expect(run.state.ending).toBe(script.ending);
        expect(run.state.clock).toEqual(whole.state.clock);
        expect(run.state.clock.day).toBe(script.finalDay);
        expect(run.milestones).toEqual(whole.milestones);
        expect(run.next).toBe(script.inputs.length);
        expect(clockMoves).toBeGreaterThan(0);
      });
    }

    test('a step leaves the run it was given unchanged', () => {
      const script = readJson(`${PUBLIC}demos/fellowship.json`) as DemoScript;
      const start = startDemo(script, assets());
      const clock = { ...start.state.clock };
      const stepped = stepDemo(start);
      expect(stepped).not.toBe(start);
      expect(start.state.clock).toEqual(clock);
      expect(start.next).toBe(0);
      expect(start.decided).toBeNull();
    });
  }
);
