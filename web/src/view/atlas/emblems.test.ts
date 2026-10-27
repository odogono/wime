import { expect, test } from 'bun:test';

import type { Force, RosterEntry } from '../../sim/index';
import { emblemLayers } from './emblems';

const led = (name: string, isUnit: boolean, icon = 0, index = 0): Force =>
  ({ leader: { icon, index, isUnit, name } as RosterEntry }) as Force;

const names = (force: Force): string[] =>
  emblemLayers(force).map(layer => layer.name);

test('draws a Character with their own silhouette', () => {
  expect(names(led('ARAGORN', false))).toEqual(['aragorn']);
  expect(names(led('the 4th NAZGUL', false))).toEqual(['nazgul']);
  expect(names(led('ERKENBRAND', false))).toEqual(['rohan-lord']);
  expect(names(led('SOMEONE', false))).toEqual(['banner']);
});

test("lays a Unit's device and mark on a round shield", () => {
  expect(names(led('cavalry', true, 0x20))).toEqual([
    'round-shield',
    'device-rohan',
    'mark-cavalry'
  ]);
});

test('gives elite troops the heraldic shield', () => {
  expect(names(led('tower guards', true, 0x05))[0]).toBe('shield');
});

test('overrides a Badge that does not fit its Unit', () => {
  expect(names(led('Rangers', true, 0x22, 57))[1]).toBe('device-dunedain');
  expect(names(led('wolves', true, 0x43, 188))).toEqual([
    'round-shield',
    'device-beasts'
  ]);
});
