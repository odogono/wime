import { expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../../sim/index';
import { emblemFor } from './emblems';

const led = (name: string, isUnit: boolean): Force =>
  ({ leader: { isUnit, name } as RosterEntry }) as Force;

test('draws a named Leader with their own emblem', () => {
  expect(emblemFor(led('ARAGORN', false))).toBe('aragorn');
  expect(emblemFor(led('Rohirrim scouts', true))).toBe('rohan-cavalry');
});

test('stands every other Character on the banner and Unit on the shield', () => {
  expect(emblemFor(led('BOROMIR', false))).toBe('banner');
  expect(emblemFor(led('orcs', true))).toBe('shield');
});
