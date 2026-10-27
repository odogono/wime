import { describe, expect, test } from 'bun:test';

import type { Ending } from '../web/src/sim';
import { assetsExist, loadSoakAssets } from './soak';
import {
  DEMO_VERSION,
  isGoodVictory,
  loadDemo,
  playCampaign,
  policyFor,
  replayDemo,
  type PlanName
} from './strategy';

// Release acceptance (#243): each committed demo script replays from
// its seed, through the player's inputs alone, to a Good victory.
describe.skipIf(!assetsExist())('demo scripts', () => {
  const plans: [PlanName, Ending][] = [
    ['fellowship', 'won-mount-doom'],
    ['muster', 'won-barad-dur'],
    ['defensive', 'won-mount-doom']
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
      // Replay alone cannot catch a changed policy: regenerate the
      // recorded inputs too, so the knowledge refactor preserves play.
      const played = playCampaign(
        script.seed,
        loadSoakAssets(),
        policyFor(plan)
      );
      expect(played.inputs).toEqual(script.inputs);
      expect(played.state.ending).toBe(script.ending);
      expect(played.state.clock.day).toBe(script.finalDay);
    });
  }
});

// The sceptre errand: Frodo picks the sceptre up on his way, hands it
// to Merry at Rivendell before the Council, and the Council puts Merry
// at Minas Tirith, where showing it mobilises Denethor and so sets War
// Event 3 before the war (finding:mobilisation-token-shown-to-ruler).
describe.skipIf(!assetsExist())('the sceptre errand', () => {
  test('mobilises Denethor and wakes Gondor before the war', () => {
    const { inputs, milestones } = playCampaign(
      1,
      loadSoakAssets(),
      policyFor('muster', { openWar: false }),
      100
    );
    expect(
      inputs.flatMap(input =>
        input.kind === 'object'
          ? [`${input.act} ${input.member} ${input.object}`]
          : []
      )
    ).toEqual(['take 7 14', 'put-down 7 14', 'take 9 14', 'use 9 14']);
    expect(milestones.council).toBe(29);
    expect(milestones.mobilisation).toEqual({ day: 89, leader: 'DENETHOR' });
    expect(milestones.warEvents).toEqual([{ day: 90, event: 3 }]);
  });
});

// Every plan runs the errand on the Classic Setup when Tokens is on
// (#282): Frodo's road to Rivendell starts at the sceptre, so he takes
// it, and Merry carries it to Denethor.
describe.skipIf(!assetsExist())('the sceptre errand under every plan', () => {
  test.each<PlanName>(['fellowship', 'muster', 'defensive'])(
    '%s takes the sceptre and shows it to Denethor',
    plan => {
      const { inputs } = playCampaign(
        1,
        loadSoakAssets(),
        policyFor(plan, { tokens: true }),
        100
      );
      expect(
        inputs.flatMap(input =>
          input.kind === 'object'
            ? [`${input.act} ${input.member} ${input.object}`]
            : []
        )
      ).toEqual(['take 7 14', 'put-down 7 14', 'take 9 14', 'use 9 14']);
    }
  );
});
