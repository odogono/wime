import { expect, test } from 'bun:test';

import { resolveAddress, sliceListing } from './asm';

const labels = new Map([
  ['code+0x06b5c', 'pickUpObject'],
  ['data+0x1de8', 'roster']
]);

test('resolves labels and each address form', () => {
  expect(resolveAddress('pickUpObject', labels)).toBe(0x6b_5c);
  expect(resolveAddress('code+0x06b5c', labels)).toBe(0x6b_5c);
  expect(resolveAddress('0x6b5c', labels)).toBe(0x6b_5c);
  expect(resolveAddress('6b5c', labels)).toBe(0x6b_5c);
  expect(resolveAddress('roster', labels)).toBeUndefined();
});

test('opens at the first instruction at or after the address', () => {
  const listing = [
    'code+0x00000  4e71  nop',
    '',
    'start:',
    'code+0x00004  4e71  nop',
    'code+0x00006  4e75  rts'
  ].join('\n');
  expect(sliceListing(listing, 0x2, 2)).toEqual([
    'code+0x00004  4e71  nop',
    'code+0x00006  4e75  rts'
  ]);
  expect(sliceListing(listing, 0x8, 2)).toEqual([]);
});
