import { describe, expect, test } from 'bun:test';

import {
  createSim,
  restoreSave,
  serialiseSave,
  type SimState
} from '../sim/index';
import { WAR_EVENT_BOXES, takeWarEventMessage } from './war-event-message';

// The War Event announcements on screen (docs/spec/war-events.md).
const waiting = (...announcements: SimState['announcements']): SimState => ({
  ...createSim(1),
  announcements
});

describe('war event messages', () => {
  test("show the original's wording", () => {
    const shown = takeWarEventMessage(waiting({ day: 149, event: 4 }));
    expect(shown.message).toEqual({
      event: 4,
      text: "Saruman's army is on the march!"
    });
    expect(shown.sim.announcements).toEqual([]);
  });

  test('are taken in order, each from the sim exactly once', () => {
    let state = takeWarEventMessage(
      waiting({ day: 169, event: 7 }, { day: 170, event: 4 })
    );
    expect(state.message?.text).toBe("The Dark Lord's armies march forth!");
    expect(state.sim.announcements).toEqual([{ day: 170, event: 4 }]);
    state = takeWarEventMessage(state.sim);
    expect(state.message?.text).toBe("Saruman's army is on the march!");
    state = takeWarEventMessage(state.sim);
    expect(state.message).toBeNull();
  });

  test('the boxes sit at the top left, sized as the original', () => {
    expect(WAR_EVENT_BOXES[4]).toEqual({ height: 24, width: 144, x: 10, y: 5 });
    expect(WAR_EVENT_BOXES[7]).toEqual({ height: 24, width: 160, x: 10, y: 5 });
  });

  test('a save keeps the announcements not yet shown, never the one shown', () => {
    const shown = takeWarEventMessage(
      waiting({ day: 169, event: 7 }, { day: 170, event: 4 })
    );
    const restored = restoreSave(serialiseSave(shown.sim), null);
    expect(restored.ok && restored.state.announcements).toEqual([
      { day: 170, event: 4 }
    ]);
  });
});
