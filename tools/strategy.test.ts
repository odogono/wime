import { describe, expect, test } from 'bun:test';

import type { Ending } from '../web/src/sim';
import { assetsExist, loadSoakAssets } from './soak';
import {
  DEMO_VERSION,
  isGoodVictory,
  loadDemo,
  replayDemo,
  type PlanName
} from './strategy';

// Release acceptance (#243): each committed demo script replays from
// its seed, through the player's inputs alone, to a Good victory.
describe.skipIf(!assetsExist())('demo scripts', () => {
  const plans: [PlanName, Ending][] = [
    ['fellowship', 'won-mount-doom'],
    ['muster', 'won-barad-dur']
  ];

  for (const [plan, ending] of plans) {
    test(`${plan} replays to ${ending}`, () => {
      const script = loadDemo(plan);
      expect(script.version).toBe(DEMO_VERSION);
      expect(script.ending).toBe(ending);
      const { milestones, state } = replayDemo(script, loadSoakAssets());
      expect(state.ending).toBe(script.ending);
      expect(isGoodVictory(state.ending)).toBe(true);
      expect(state.clock.day).toBe(script.finalDay);
      expect(milestones).toEqual(script.milestones);
      expect(milestones.council).not.toBeNull();
    });
  }
});
