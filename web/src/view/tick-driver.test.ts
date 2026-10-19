import { describe, expect, test } from 'bun:test';

import { layoutSpeedWindow, speedWindowOptionAt } from './speed-window';
import { TICKS_PER_SECOND, createTickDriver } from './tick-driver';

describe('tick driver', () => {
  test('each Game Speed turns real time into ticks at its own rate', () => {
    for (const [speed, perSecond] of Object.entries(TICKS_PER_SECOND)) {
      const driver = createTickDriver(speed as keyof typeof TICKS_PER_SECOND);
      expect(driver.advance(1000)).toBe(perSecond);
      expect(driver.advance(10_000)).toBe(perSecond * 10);
    }
  });

  test('accumulates fractional time instead of dropping it', () => {
    const driver = createTickDriver('normal');
    expect(driver.advance(400)).toBe(0);
    expect(driver.advance(400)).toBe(0);
    expect(driver.advance(400)).toBe(1);
  });

  test('changing speed changes only the rate, pausing stops ticks', () => {
    const driver = createTickDriver('normal');
    expect(driver.advance(500)).toBe(0);
    driver.speed = 'very-hasty';
    // 500ms banked + 500ms more at 4 ticks/sec = 4 ticks in a second.
    expect(driver.advance(500)).toBe(4);
    driver.paused = true;
    expect(driver.advance(10_000)).toBe(0);
    driver.paused = false;
    expect(driver.advance(250)).toBe(1);
  });
});

describe('speed window', () => {
  test('lists the three speeds and a pause line under the anchor', () => {
    const window = layoutSpeedWindow(318, 90, false);
    expect(window.options.map(o => o.label)).toEqual([
      'Normal',
      'Hasty',
      'Very Hasty',
      'Pause'
    ]);
    expect(window.x + window.width).toBe(318);
    expect(window.y).toBe(90);
  });

  test('hit-tests options and switches the pause line to Resume', () => {
    const window = layoutSpeedWindow(318, 90, true);
    const first = window.options[0]!;
    expect(speedWindowOptionAt(window, first.x + 1, first.y + 1)?.value).toBe(
      'normal'
    );
    expect(window.options[3]?.label).toBe('Resume');
    expect(speedWindowOptionAt(window, 0, 0)).toBeUndefined();
  });
});
