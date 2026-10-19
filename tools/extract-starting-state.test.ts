import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'bun:test';

import { DEFAULT_ARCHIVE, ExtractError } from './extract-graphics';
import {
  decodeTrigger,
  gridReference,
  loadExecutable,
  parseHunkFile,
  readStartingState,
  type StartingState
} from './extract-starting-state';
import { loadCampaignMapAssets } from './render-campaign-map';

const longs = (...values: number[]): Uint8Array => {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, false));
  return bytes;
};

test('parses code, data and BSS hunks with their relocations', () => {
  const file = longs(
    0x03_f3,
    0, // no resident libraries
    3,
    0,
    2,
    1, // code: 1 long
    3, // data: 2 longs loaded, 1 more zeroed
    2, // BSS: 2 longs
    0x03_e9,
    1,
    0x4e_75_4e_75,
    0x03_f2,
    0x03_ea,
    2,
    0x00_00_00_04,
    0xde_ad_be_ef,
    0x03_ec,
    1, // one pointer...
    0, // ...into the code hunk...
    0, // ...at offset 0
    0,
    0x03_f2,
    0x03_eb,
    2,
    0x03_f2
  );

  const hunks = parseHunkFile(file);

  expect(hunks.map(hunk => [hunk.type, hunk.size])).toEqual([
    ['code', 4],
    ['data', 12],
    ['bss', 8]
  ]);
  expect([...hunks[1]!.data]).toEqual([
    0, 0, 0, 4, 0xde, 0xad, 0xbe, 0xef, 0, 0, 0, 0
  ]);
  expect(hunks[1]!.relocs).toEqual(new Map([[0, [0]]]));
});

test('rejects a file without the hunk header', () => {
  expect(() => parseHunkFile(longs(0x03_e9))).toThrow(ExtractError);
});

test('decodes the trigger byte by its highest set bit', () => {
  expect(decodeTrigger(0)).toEqual({ kind: 'none' });
  expect(decodeTrigger(0x01)).toEqual({
    event_bit: 0,
    kind: 'near-ring-bearer'
  });
  expect(decodeTrigger(0x04)).toEqual({
    event_bit: 2,
    kind: 'near-gandalf'
  });
  expect(decodeTrigger(0x08)).toEqual({ event_bit: 3, kind: 'on-event' });
  expect(decodeTrigger(0x8d)).toEqual({
    days_after: 13,
    event_bit: 7,
    kind: 'after-event'
  });
  expect(decodeTrigger(0x22)).toEqual({
    days_after: 2,
    event_bit: 5,
    kind: 'after-event'
  });
});

test('reads a grid reference as column letter and row digit', () => {
  expect(gridReference(0x32)).toBe('B3');
  expect(gridReference(0x69)).toBe('E6');
  expect(gridReference(0x94)).toBe('C9');
});

// The Reference Build lives in the gitignored artifacts/ dir and is absent
// in CI; these tests skip there.
describe.skipIf(!existsSync(DEFAULT_ARCHIVE))(
  'reference starting state',
  () => {
    let state: StartingState;
    beforeAll(() => {
      state = readStartingState(
        loadExecutable(DEFAULT_ARCHIVE),
        loadCampaignMapAssets(DEFAULT_ARCHIVE).mapIndices
      );
    });

    const byName = (name: string) =>
      state.roster.find(entry => entry.name === name)!;

    test('starts on 23 September 1418, shown as 5 p.m.', () => {
      expect(state.clock).toEqual({
        date: '23 September 1418 S.R.',
        day: 0,
        display_hour: '5 p.m.',
        quarter_hour: 64
      });
      expect(state.calendar.months.map(month => month.first_day)).toEqual([
        -22, 8, 38, 68, 100, 130, 160, 190
      ]);
    });

    test('reads every roster entry, Place and Place kind', () => {
      expect(state.roster).toHaveLength(196);
      expect(state.places).toHaveLength(69);
      expect(state.places[0]!.name).toBe('ANNUMINAS');
      expect(state.places.at(-1)!.name).toBe('RAMMAS FORTS');
      expect(state.place_kinds.map(kind => kind.name)).toContain(
        'a small town'
      );
      expect(state.roster.filter(entry => entry.ticked)).toHaveLength(151);
    });

    test('puts Frodo at Hobbiton with the Ring and an Elven blade', () => {
      const frodo = byName('FRODO');
      const hobbiton = state.places.find(place => place.name === 'HOBBITON')!;
      expect(frodo.position).toEqual(hobbiton.position);
      expect(hobbiton.grid_reference).toBe('B3');
      expect(state.places.at(-1)!.grid_reference).toBeNull();
      expect(frodo.objects.map(index => state.objects[index]!.name)).toEqual([
        'the Ring',
        'an Elven blade'
      ]);
      expect(state.events.ring_bearer).toBe(frodo.index);
      expect(state.routes[frodo.route]!.places).toEqual([10, 11, 12, 16, 23]);
    });

    test('groups Sam and Pippin into Frodo’s Force', () => {
      const frodo = byName('FRODO');
      const force = state.forces.find(f => f.leader === frodo.index)!;
      expect(force.members.map(index => state.roster[index]!.name)).toEqual([
        'FRODO',
        'SAM',
        'PIPPIN'
      ]);
    });

    test('marks Units by a starting strength above one', () => {
      expect(byName('ARAGORN').is_unit).toBe(false);
      const eomerRiders = state.roster.find(
        entry => entry.leader === byName('EOMER').index
      )!;
      expect(eomerRiders).toMatchObject({ is_unit: true, strength: 120 });
    });

    test('gives every Force a position on the 2560x1584 map', () => {
      for (const force of state.forces) {
        expect(force.leader).toBeLessThanOrEqual(151);
        expect(force.position.x).toBeLessThan(2560);
        expect(force.position.y).toBeLessThan(1584);
      }
    });

    test('keeps the Encounter figures in areas, off the map', () => {
      const ranger = byName('a Ranger');
      expect(ranger.position).toBeNull();
      expect(ranger.encounter).toEqual({
        area: { bottom: 592, left: 418, right: 1168, top: 144 },
        chance: 5,
        earliest_day: 0
      });
    });
  }
);
