import { describe, expect, test } from 'bun:test';

import {
  createSim,
  restoreSave,
  serialiseSave,
  type SimState
} from '../sim/index';
import { GAME_SPEEDS } from './tick-driver';
import {
  WAR_EVENT_BOXES,
  stepWarEventMessage,
  type WarEventMessage
} from './war-event-message';

// The War Event announcements on screen (docs/spec/war-events.md).
const WAR_EVENT_MESSAGE_MS = 4000;

const waiting = (...announcements: SimState['announcements']): SimState => ({
  ...createSim(1),
  announcements
});

const step = (
  message: WarEventMessage | null,
  sim: SimState,
  now: number,
  free = true
) => stepWarEventMessage(message, sim, now, free);

describe('war event messages', () => {
  for (const { speed } of GAME_SPEEDS) {
    test(`${speed} closes each queued box at its message timeout`, () => {
      const duration = speed === 'very-hasty' ? 1200 : 4000;
      const shown = stepWarEventMessage(
        null,
        waiting({ day: 149, event: 4 }, { day: 169, event: 7 }),
        1000,
        true,
        speed
      );
      expect(shown.message?.until).toBe(1000 + duration);
      const still = stepWarEventMessage(
        shown.message,
        shown.sim,
        1000 + duration - 1,
        true,
        speed
      );
      expect(still.message?.event).toBe(4);
      const next = stepWarEventMessage(
        still.message,
        still.sim,
        1000 + duration,
        true,
        speed
      );
      expect(next.message?.event).toBe(7);
      expect(next.message?.until).toBe(1000 + duration * 2);
      expect(
        stepWarEventMessage(
          next.message,
          next.sim,
          1000 + duration * 2,
          true,
          speed
        ).message
      ).toBeNull();
    });
  }

  test('a speed change leaves the open box alone and sets the next box timeout', () => {
    const shown = stepWarEventMessage(
      null,
      waiting({ day: 149, event: 4 }, { day: 169, event: 7 }),
      0,
      true,
      'normal'
    );
    const still = stepWarEventMessage(
      shown.message,
      shown.sim,
      2000,
      true,
      'very-hasty'
    );
    expect(still.message?.until).toBe(4000);
    const next = stepWarEventMessage(
      still.message,
      still.sim,
      4000,
      true,
      'very-hasty'
    );
    expect(next.message?.until).toBe(5200);
  });

  test("show the original's wording for 200 frames, then close", () => {
    const shown = step(null, waiting({ day: 149, event: 4 }), 1000);
    expect(shown.message).toMatchObject({
      event: 4,
      text: "Saruman's army is on the march!",
      until: 1000 + WAR_EVENT_MESSAGE_MS
    });
    expect(WAR_EVENT_MESSAGE_MS).toBe(4000);
    expect(shown.sim.announcements).toEqual([]);
    const still = step(shown.message, shown.sim, 4999);
    expect(still.message?.text).toBe("Saruman's army is on the march!");
    expect(step(still.message, still.sim, 5000).message).toBeNull();
  });

  test('queue in order, each taken from the sim exactly once', () => {
    let state = step(
      null,
      waiting({ day: 169, event: 7 }, { day: 170, event: 4 }),
      0
    );
    expect(state.message?.text).toBe("The Dark Lord's armies march forth!");
    expect(state.sim.announcements).toEqual([{ day: 170, event: 4 }]);
    state = step(state.message, state.sim, WAR_EVENT_MESSAGE_MS);
    expect(state.message?.text).toBe("Saruman's army is on the march!");
    expect(state.sim.announcements).toEqual([]);
    state = step(state.message, state.sim, 2 * WAR_EVENT_MESSAGE_MS);
    expect(state.message).toBeNull();
  });

  test('the boxes sit at the top left, sized as the original', () => {
    expect(WAR_EVENT_BOXES[4]).toEqual({ height: 24, width: 144, x: 10, y: 5 });
    expect(WAR_EVENT_BOXES[7]).toEqual({ height: 24, width: 160, x: 10, y: 5 });
  });

  test('wait, time kept, while a fight or the Full Map Level holds the box', () => {
    // Nothing is taken while the box is busy.
    const busy = step(null, waiting({ day: 149, event: 4 }), 0, false);
    expect(busy.message).toBeNull();
    expect(busy.sim.announcements).toHaveLength(1);
    // A message on screen keeps its remaining time across the wait.
    const shown = step(null, waiting({ day: 149, event: 4 }), 0);
    const part = step(shown.message, shown.sim, 1000);
    const held = step(part.message, part.sim, 60_000, false);
    expect(held.message?.until).toBe(63_000);
    const back = step(held.message, held.sim, 61_000);
    expect(back.message?.until).toBe(63_000);
    expect(step(back.message, back.sim, 63_000).message).toBeNull();
  });

  test('a save keeps the announcements not yet shown, never the one shown', () => {
    const shown = step(
      null,
      waiting({ day: 169, event: 7 }, { day: 170, event: 4 }),
      0
    );
    const restored = restoreSave(serialiseSave(shown.sim), null);
    expect(restored.ok && restored.state.announcements).toEqual([
      { day: 170, event: 4 }
    ]);
  });
});
