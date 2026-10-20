import { describe, expect, test } from 'bun:test';

import { createSim, type SimState } from '../sim/index';
import { textKey } from './assets';
import {
  COUNCIL_MESSAGE_MS,
  councilMessageLines,
  stepCouncilMessage
} from './council-message';

// The Council of Elrond's message on screen
// (docs/spec/council-of-elrond.md, "The message").

const texts = new Map([
  [textKey('BScene.res', 46), '   In the House of Elrond\ngreat council\n'],
  [textKey('BScene.res', 47), 'the destruction of the Ring, and \n'],
  [textKey('BScene.res', 48), 'appointed the Ring-bearer.\nrests.\n']
]);

const held = (): SimState => {
  const sim = createSim(1);
  const roster = Array.from({ length: 8 }, (_, index) => ({
    ...({} as SimState['roster'][number]),
    index,
    name: index === 7 ? 'FRODO' : ''
  }));
  return { ...sim, council: { ringBearer: 7 }, roster };
};

describe('the Council message', () => {
  test('reads CSTR 46, then 47 with the Ring-bearer, then 48', () => {
    expect(councilMessageLines(held(), texts)).toEqual([
      '   In the House of Elrond',
      'great council',
      'the destruction of the Ring, and FRODO was',
      'appointed the Ring-bearer.',
      'rests.'
    ]);
  });

  test('stays 1200 frames, then lets game time run', () => {
    expect(COUNCIL_MESSAGE_MS).toBe(24_000);
    const opened = stepCouncilMessage(null, held(), texts, 1000);
    expect(opened.window!.until).toBe(25_000);
    const still = stepCouncilMessage(opened.window, opened.sim, texts, 24_999);
    expect(still.sim.council).not.toBeNull();
    const closed = stepCouncilMessage(still.window, still.sim, texts, 25_000);
    expect(closed.window).toBeNull();
    expect(closed.sim.council).toBeNull();
  });

  test('opens nothing with no Council waiting', () => {
    expect(stepCouncilMessage(null, createSim(1), texts, 0).window).toBeNull();
  });
});
