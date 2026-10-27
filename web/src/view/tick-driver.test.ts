import { describe, expect, test } from 'bun:test';

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

  test("Very Hasty waits 4 frames at 50 Hz per quarter-hour, the sweep's average", () => {
    const driver = createTickDriver('very-hasty');
    expect(driver.advance(79)).toBe(0);
    expect(driver.advance(1)).toBe(1);
    expect(driver.advance(80 * 96)).toBe(96);
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
    expect(driver.advance(80)).toBe(1);
  });
});
