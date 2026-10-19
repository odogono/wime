import { expect, test } from 'bun:test';

import {
  a4Targets,
  disassembleCode,
  formatListing,
  parseLabels
} from './disasm';

test('reads code and data labels from the labels table', () => {
  const labels = parseLabels(
    [
      '| `code+0x1b022` | `setA4`              | `lea data+0x7ffe, a4` |',
      '| `data+0x1de8`  | `roster`             | 196 records |',
      '| Address | Label | What it does |'
    ].join('\n')
  );
  expect([...labels]).toEqual([
    ['code+0x1b022', 'setA4'],
    ['data+0x1de8', 'roster']
  ]);
});

test('resolves d(a4) operands to data offsets', () => {
  expect(a4Targets('-$6216(a4), a0')).toEqual([0x1d_e8]);
  expect(a4Targets('$10(a4), -$7dac(a4)')).toEqual([0x80_0e, 0x02_52]);
  expect(a4Targets('$10(a6)')).toEqual([]);
});

test('disassembles past words that are not instructions', async () => {
  const code = new Uint8Array([
    0x41,
    0xec,
    0x9d,
    0xea, // lea -$6216(a4), a0
    0xff,
    0xff, // not an instruction
    0x4e,
    0x75 // rts
  ]);
  const listing = formatListing(
    await disassembleCode(code),
    new Map([
      ['code+0x00006', 'done'],
      ['data+0x1de8', 'roster']
    ])
  );
  expect(listing).toContain('lea.l -$6216(a4), a0  ; data+0x1de8 roster');
  expect(listing).toContain('code+0x00004  ffff');
  expect(listing).toContain('done:\ncode+0x00006  4e75                  rts');
});
