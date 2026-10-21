import { describe, expect, test } from 'bun:test';

import { stepGandalfsLetter } from './gandalfs-letter';
import { FRAME_MS } from './tick-driver';

describe("Gandalf's letter", () => {
  test('waits for the Animation Level, then closes after 200 frames', () => {
    const pending = { kind: 'pending' } as const;
    expect(stepGandalfsLetter(pending, 0, false, 'normal')).toBe(pending);
    const open = stepGandalfsLetter(pending, 100, true, 'normal');
    expect(open).toEqual({ kind: 'open', until: 100 + 200 * FRAME_MS });
    expect(stepGandalfsLetter(open, 100 + 199 * FRAME_MS, true, 'normal')).toBe(
      open
    );
    expect(
      stepGandalfsLetter(open, 100 + 200 * FRAME_MS, true, 'normal')
    ).toBeNull();
  });

  test('closes after 60 frames on Very Hasty', () => {
    expect(
      stepGandalfsLetter({ kind: 'pending' }, 0, true, 'very-hasty')
    ).toEqual({ kind: 'open', until: 60 * FRAME_MS });
  });

  test('is shown once', () => {
    expect(stepGandalfsLetter(null, 0, true, 'normal')).toBeNull();
  });
});
