import { expect, test } from 'bun:test';

import { decodeScript } from './figure-script';

test('decodes each op, jumps, calls and returns', () => {
  expect(
    decodeScript(
      new Uint8Array([0x00, 0xb9, 0x05, 0xca, 0xb8, 0x00, 0xbf, 0x91])
    )
  ).toEqual([
    '00: 00 frame 00',
    '01: b9 call if 18 -> 05',
    '03: ca speed 0a',
    '04: b8 jump if 18 -> 00',
    '06: bf return',
    '07: 91 event 11'
  ]);
});
