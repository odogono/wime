import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
  campaignMilestones,
  campaignOver,
  replayDemo,
  sameClock,
  startDemo,
  stepDemo,
  type DemoAssets,
  type DemoPlan,
  type DemoScript
} from './demo';
import { loadTerrainRegions, terrainGridFrom } from './terrain';
import { loadWaterways } from './waterways';

const PUBLIC = new URL('../../public/', import.meta.url).pathname;
const STARTING_STATE = `${PUBLIC}assets/starting-state.json`;
const TERRAIN = `${PUBLIC}assets/geography/terrain-regions.json`;
const WATERWAYS = `${PUBLIC}assets/geography/waterways.json`;
const PLANS: DemoPlan[] = ['fellowship', 'muster', 'defensive'];

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

// Called only inside the skipped block, so CI never reads the assets.
const assets = (): DemoAssets => ({
  startingState: readJson(STARTING_STATE),
  terrain: terrainGridFrom(loadTerrainRegions(readJson(TERRAIN))),
  waterways: loadWaterways(readJson(WATERWAYS))
});

describe.skipIf(
  !existsSync(STARTING_STATE) || !existsSync(TERRAIN) || !existsSync(WATERWAYS)
)('the step-wise Demo driver', () => {
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

  test('milestones include the Council on the final step before a cutoff', () => {
    const script = readJson(`${PUBLIC}demos/fellowship.json`) as DemoScript;
    let run = startDemo(script, assets());
    while (run.state.councilPending && !campaignOver(run, 400)) {
      run = stepDemo(run);
    }
    expect(run.state.councilPending).toBe(false);
    // The next decision has not recorded the Council yet. A survey
    // that ends here must still date it before the calendar jump.
    expect(run.milestones.council).toBeNull();
    expect(campaignMilestones(run).council).toBe(run.decided!.day);
  });

  test('milestones include a War Event set on the final step', () => {
    const script = readJson(`${PUBLIC}demos/muster.json`) as DemoScript;
    let run = startDemo(script, assets());
    while (!(run.state.warEvents.mask & (1 << 7)) && !campaignOver(run, 400)) {
      run = stepDemo(run);
    }
    expect(run.milestones.warEvents.some(noted => noted.event === 7)).toBe(
      false
    );
    expect(campaignMilestones(run).warEvents).toContainEqual({
      day: run.state.warEvents.days[7]!,
      event: 7
    });
  });
});
