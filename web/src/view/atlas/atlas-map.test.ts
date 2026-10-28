import { expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../../sim/index';
import { blinks } from './atlas-map';

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
