import { describe, expect, test } from 'bun:test';

import { layoutSpeedWindow, speedWindowOptionAt } from './speed-window';
import { createTickDriver } from './tick-driver';

describe('tick driver', () => {
  test('Normal waits 256 frames at 50 Hz per quarter-hour', () => {
    const driver = createTickDriver('normal');
    expect(driver.advance(5119)).toBe(0);
    expect(driver.advance(1)).toBe(1);
    expect(driver.advance(5120 * 96)).toBe(96);
  });

  test('Hasty waits 30 frames at 50 Hz per quarter-hour', () => {
    const driver = createTickDriver('hasty');
    expect(driver.advance(599)).toBe(0);
    expect(driver.advance(1)).toBe(1);
    expect(driver.advance(600 * 96)).toBe(96);
  });

  test('Very Hasty ticks once per rendered frame, including after a long gap', () => {
    const driver = createTickDriver('very-hasty');
    expect(driver.advance(1000 / 144)).toBe(1);
    expect(driver.advance(1000 / 60)).toBe(1);
    expect(driver.advance(1000 / 30)).toBe(1);
    expect(driver.advance(60_000)).toBe(1);
  });

  test('accumulates fractional time instead of dropping it', () => {
    const driver = createTickDriver('normal');
    expect(driver.advance(2000)).toBe(0);
    expect(driver.advance(2000)).toBe(0);
    expect(driver.advance(2000)).toBe(1);
    expect(driver.advance(4240)).toBe(1);
  });

  test('changing speed uses the time already accumulated', () => {
    const driver = createTickDriver('normal');
    expect(driver.advance(500)).toBe(0);
    driver.speed = 'hasty';
    expect(driver.advance(100)).toBe(1);
    driver.speed = 'normal';
    expect(driver.advance(5119)).toBe(0);
    expect(driver.advance(1)).toBe(1);
  });

  test('Very Hasty clears accumulated time before returning to a timed speed', () => {
    const driver = createTickDriver('normal');
    expect(driver.advance(5000)).toBe(0);
    driver.speed = 'very-hasty';
    expect(driver.advance(10_000)).toBe(1);
    driver.speed = 'normal';
    expect(driver.advance(5119)).toBe(0);
    expect(driver.advance(1)).toBe(1);
  });

  test('pausing excludes elapsed time and preserves the fractional tick', () => {
    const driver = createTickDriver('hasty');
    expect(driver.advance(599)).toBe(0);
    driver.paused = true;
    expect(driver.advance(10_000)).toBe(0);
    driver.paused = false;
    expect(driver.advance(1)).toBe(1);
    driver.speed = 'very-hasty';
    driver.paused = true;
    expect(driver.advance(10_000)).toBe(0);
    driver.paused = false;
    expect(driver.advance(16)).toBe(1);
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
