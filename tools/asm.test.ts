import { expect, test } from 'bun:test';

import {
  refsTo,
  resolveAddress,
  resolveTarget,
  routineListing,
  routineStarts,
  sliceListing
} from './asm';

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

const routines = [
  'first:',
  'code+0x00000  4e55fffc  link.w a5, #$fffc',
  'code+0x00004  4eba0006  jsr $c(pc)  ; -> code+0x0000c',
  'code+0x00008  4e5d      unlk a5',
  'code+0x0000a  4e75      rts',
  'code+0x0000c  302c8000  move.w -$8000(a4), d0  ; data+0xfffe',
  'code+0x00010  4e75      rts',
  'code+0x00012  4eac8002  jsr -$7ffe(a4)  ; data+0x0000 -> code+0x0000c'
].join('\n');

test('reads lines before the address', () => {
  expect(sliceListing(routines, 0xc, 1, 2)).toEqual([
    'code+0x00008  4e5d      unlk a5',
    'code+0x0000a  4e75      rts',
    'code+0x0000c  302c8000  move.w -$8000(a4), d0  ; data+0xfffe'
  ]);
});

test('finds routines at labels, links and call targets', () => {
  expect(routineStarts(routines)).toEqual([0x0, 0xc]);
  expect(routineListing(routines, 0x10)).toEqual([
    'code+0x0000c  302c8000  move.w -$8000(a4), d0  ; data+0xfffe',
    'code+0x00010  4e75      rts',
    'code+0x00012  4eac8002  jsr -$7ffe(a4)  ; data+0x0000 -> code+0x0000c'
  ]);
});

test('lists direct and jump table calls with their routines', () => {
  const names = new Map([['code+0x00000', 'first']]);
  expect(refsTo(routines, { hunk: 'code', offset: 0xc }, names)).toEqual([
    'code+0x00004  4eba0006  jsr $c(pc)  ; -> code+0x0000c  [in code+0x00000 first]',
    'code+0x00012  4eac8002  jsr -$7ffe(a4)  ; data+0x0000 -> code+0x0000c  [in code+0x0000c]'
  ]);
  expect(
    refsTo(routines, { hunk: 'data', offset: 0xff_fe }, names)
  ).toHaveLength(1);
});

test('resolves data labels and addresses', () => {
  expect(resolveTarget('roster', labels)).toEqual({
    hunk: 'data',
    offset: 0x1d_e8
  });
  expect(resolveTarget('data+0x1de8', labels)).toEqual({
    hunk: 'data',
    offset: 0x1d_e8
  });
});
