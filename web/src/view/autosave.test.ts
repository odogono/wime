import { describe, expect, test } from 'bun:test';

import { autosaveDue, autosavePoint, gameHour } from './autosave';

const at = (quarterHour: number, level = 'campaign', settled = true) => ({
  clock: { day: 2, quarterHour },
  level,
  settled
});

describe('autosave', () => {
  test('counts game hours across days', () => {
    expect(gameHour({ day: 0, quarterHour: 3 })).toBe(0);
    expect(gameHour({ day: 0, quarterHour: 4 })).toBe(1);
    expect(gameHour({ day: 1, quarterHour: 0 })).toBe(24);
  });

  test('is due on each new game hour', () => {
    const last = autosavePoint(at(40));
    expect(autosaveDue(last, at(43))).toBe(false);
    expect(autosaveDue(last, at(44))).toBe(true);
  });

  test('is due when the Level changes', () => {
    const last = autosavePoint(at(40));
    expect(autosaveDue(last, at(41, 'full-map'))).toBe(true);
  });

  test('waits until the game can be restored cleanly', () => {
    const last = autosavePoint(at(40));
    expect(autosaveDue(last, at(48, 'animation', false))).toBe(false);
    expect(autosaveDue(last, at(48, 'animation'))).toBe(true);
  });
});
