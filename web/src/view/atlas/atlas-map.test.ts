import { expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../../sim/index';
import { blinks, wayDots } from './atlas-map';

const led = (allegiance: number): Force =>
  ({ leader: { allegiance } as RosterEntry }) as Force;

test('blinks the Forces Classic blinks on the Full Map Level', () => {
  expect([0, 1, 2, 3, 99].map(a => blinks(led(a)))).toEqual([
    false,
    false,
    false,
    true,
    true
  ]);
});

test('dots a Way along each leg and rings its Crossing and destination', () => {
  const dots = wayDots(
    {
      destination: { x: 200, y: 100 },
      from: { x: 0, y: 0 },
      waypoint: { x: 0, y: 100 }
    },
    p => p
  );
  const near = (c: { x: number; y: number }, r: number) =>
    dots.filter(d => Math.abs(Math.hypot(d.x - c.x, d.y - c.y) - r) < 0.01);
  // Ring dots sit 13 pixels from the Crossing's and destination's
  // centres; no leg dot lands inside a ring.
  const crossing = near({ x: 8, y: 108 }, 13);
  const destination = near({ x: 208, y: 108 }, 13);
  expect(crossing.length).toBeGreaterThan(6);
  expect(destination.length).toBe(crossing.length);
  for (const c of [
    { x: 8, y: 108 },
    { x: 208, y: 108 }
  ]) {
    expect(dots.every(d => Math.hypot(d.x - c.x, d.y - c.y) > 12.9)).toBe(true);
  }
  // The first leg runs straight down from the Force.
  expect(dots[0]).toEqual({ x: 8, y: 19 });
});

test('a Way with no Crossing rings only its destination', () => {
  const dots = wayDots(
    { destination: { x: 100, y: 0 }, from: { x: 0, y: 0 }, waypoint: null },
    p => p
  );
  expect(
    dots.every(d => d.y === 8 || Math.hypot(d.x - 108, d.y - 8) > 12.9)
  ).toBe(true);
});
