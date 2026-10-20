import { describe, expect, test } from 'bun:test';

import {
  INITIAL_CLOCK,
  advanceClock,
  calendarDate,
  displayTime,
  formatClock,
  tickClock
} from './clock';
import { createRng, nextRandom } from './rng';
import { createSim, deserializeSim, serializeSim, tickSim } from './state';

describe('clock', () => {
  test('starts on day 0 at quarter-hour 64, shown as 5 p.m. on 23 September', () => {
    expect(INITIAL_CLOCK).toEqual({ day: 0, quarterHour: 64 });
    expect(formatClock(INITIAL_CLOCK)).toBe('5 p.m.  September 23,  1418 s.r.');
  });

  test('one tick is one quarter-hour, rolling into the next day', () => {
    expect(tickClock({ day: 0, quarterHour: 64 })).toEqual({
      day: 0,
      quarterHour: 65
    });
    expect(tickClock({ day: 3, quarterHour: 95 })).toEqual({
      day: 4,
      quarterHour: 0
    });
    expect(advanceClock(INITIAL_CLOCK, 96)).toEqual({
      day: 1,
      quarterHour: 64
    });
  });

  test('crosses month and year boundaries per the calendar table', () => {
    expect(calendarDate(0)).toEqual({
      dayOfMonth: 23,
      month: 'September',
      year: 1418
    });
    expect(calendarDate(7)).toEqual({
      dayOfMonth: 30,
      month: 'September',
      year: 1418
    });
    expect(calendarDate(8)).toEqual({
      dayOfMonth: 1,
      month: 'October',
      year: 1418
    });
    // December has 32 days: it starts on day 68, January on day 100.
    expect(calendarDate(99)).toEqual({
      dayOfMonth: 32,
      month: 'December',
      year: 1418
    });
    expect(calendarDate(100)).toEqual({
      dayOfMonth: 1,
      month: 'January',
      year: 1419
    });
    expect(calendarDate(219)).toEqual({
      dayOfMonth: 30,
      month: 'April',
      year: 1419
    });
  });

  test('N ticks land on the right date across the new year', () => {
    // From day 99 quarter-hour 64, 32 ticks finish the day, 64 more
    // reach quarter-hour 64 on 1 January 1419.
    const start = { day: 99, quarterHour: 64 };
    expect(formatClock(advanceClock(start, 96))).toBe(
      '5 p.m.  January 1,  1419 s.r.'
    );
  });

  test('the display names the hour after the one under way', () => {
    expect(displayTime(0)).toEqual({ hour: 1, meridiem: 'a.m.' });
    expect(displayTime(44)).toEqual({ hour: 12, meridiem: 'p.m.' });
    expect(displayTime(64)).toEqual({ hour: 5, meridiem: 'p.m.' });
    expect(displayTime(95)).toEqual({ hour: 12, meridiem: 'a.m.' });
  });
});

const sequence = (seed: number): number[] => {
  let state = createRng(seed);
  const values: number[] = [];
  for (let i = 0; i < 5; i++) {
    const next = nextRandom(state);
    state = next.state;
    values.push(next.value);
  }
  return values;
};

describe('rng', () => {
  test('is deterministic for a seed and differs across seeds', () => {
    expect(sequence(42)).toEqual(sequence(42));
    expect(sequence(42)).not.toEqual(sequence(43));
    expect(sequence(42).every(v => v >= 0 && v < 1)).toBe(true);
  });
});

describe('sim state', () => {
  test('serialises and restores exactly, then ticks identically', () => {
    let sim = createSim(1234);
    for (let i = 0; i < 100; i++) {
      sim = tickSim(sim);
    }
    const restored = deserializeSim(serializeSim(sim));
    expect(restored).toEqual(sim);
    expect(tickSim(restored)).toEqual(tickSim(sim));
  });

  test('rejects text that is not a serialised state', () => {
    expect(() => deserializeSim('{"clock":{}}')).toThrow();
    expect(() => deserializeSim('nope')).toThrow();
  });
});
