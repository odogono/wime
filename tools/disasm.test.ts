import { expect, test } from 'bun:test';

import {
  a4Targets,
  callTarget,
  disassembleCode,
  formatListing,
  jumpTargets,
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

test('names the routine a jump table call reaches', async () => {
  const data = new Uint8Array([
    0x4e, 0xf9, 0, 0, 0, 0, 0x4e, 0xf9, 0, 0, 0, 0x08
  ]);
  expect(jumpTargets(data)).toEqual(
    new Map([
      [0, 0],
      [6, 8]
    ])
  );
  // jsr -$7ff8(a4) reaches data+0x0006, the second entry.
  const code = new Uint8Array([0x4e, 0xac, 0x80, 0x08]);
  const listing = formatListing(
    await disassembleCode(code),
    new Map([['code+0x00008', 'target']]),
    jumpTargets(data)
  );
  expect(listing).toContain('; data+0x0006 -> code+0x00008 target');
});

test('names the routine a direct call reaches', async () => {
  expect(callTarget('jsr', '$396(pc)')).toBe(0x3_96);
  expect(callTarget('jsr', '$1940c.l')).toBe(0x1_94_0c);
  expect(callTarget('bsr.b', '$2012')).toBe(0x20_12);
  expect(callTarget('jmp', '$564(pc,d0.w)')).toBeUndefined();
  expect(callTarget('bra.b', '$40')).toBeUndefined();
  // bsr.b +2 at code+0x00000 reaches code+0x00004.
  const code = new Uint8Array([0x61, 0x02, 0x4e, 0x71, 0x4e, 0x75]);
  const listing = formatListing(
    await disassembleCode(code),
    new Map([['code+0x00004', 'target']])
  );
  expect(listing).toContain('bsr.b $4  ; -> code+0x00004 target');
});
