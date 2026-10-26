import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { nextRandom } from './rng';
import { OBJECT_LIMITS } from './setup-limits';
import { setupAxisRng, shuffleSetup } from './shuffled-setup';
import { tileOf } from './starting-state';
import { createSim } from './state';

// Synthetic data: identifiers come from the design table; positions and
// metadata are invented. CI needs no original assets for the invariants.
const classic = {
  marker: { unchanged: true },
  object_placements: OBJECT_LIMITS.map((limit, i) => ({
    object: limit.object,
    position: { x: (i + 1) * 32, y: 32 }
  })),
  places: Array.from(
    new Set(OBJECT_LIMITS.flatMap(limit => [...limit.places])),
    index => ({
      index,
      position: { x: index * 16, y: 160 }
    })
  ),
  roster: [{ objects: [0, 4] }, { objects: [3] }]
};

test('every axis off returns exactly Classic, including metadata', () => {
  for (const seed of [0, 1, 1234, 0xff_ff_ff_ff]) {
    expect(shuffleSetup(classic, seed, [])).toEqual(classic);
  }
});

test('the same Setup seed and axes give the same data without mutating Classic', () => {
  const before = structuredClone(classic);
  const shuffled = shuffleSetup(classic, 1234, ['a']);
  expect(shuffleSetup(classic, 1234, ['a'])).toEqual(shuffled);
  expect(shuffleSetup(classic, 1235, ['a'])).not.toEqual(shuffled);
  expect(classic).toEqual(before);
  expect({ ...shuffled, object_placements: classic.object_placements }).toEqual(
    classic
  );
  expect(shuffled.roster).toEqual(classic.roster);
});

test('1,000 seeds keep each slot in its candidates, with no shared tiles', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const shuffled = shuffleSetup(classic, seed, ['a']);
    expect(shuffled.object_placements).toHaveLength(25);
    const tiles = new Set<string>();
    shuffled.object_placements.forEach((slot, i) => {
      const limit = OBJECT_LIMITS[i]!;
      expect(slot.object).toBe(limit.object);
      expect(
        limit.places.map(
          index => classic.places.find(place => place.index === index)!.position
        )
      ).toContainEqual(slot.position);
      tiles.add(JSON.stringify(tileOf(slot.position)));
    });
    expect(tiles.size).toBe(25);
  }
});

test('axis streams start independently and have permanent identifiers', () => {
  const b = nextRandom(setupAxisRng(42, 'b'));
  const c = nextRandom(setupAxisRng(42, 'c'));
  shuffleSetup(classic, 42, ['a']);
  expect(nextRandom(setupAxisRng(42, 'b'))).toEqual(b);
  expect(nextRandom(setupAxisRng(42, 'c'))).toEqual(c);
  expect(setupAxisRng(42, 'a')).toBe(42 ^ 0x61);
  expect(setupAxisRng(42, 'b')).toBe(42 ^ 0x62);
  expect(setupAxisRng(42, 'c')).toBe(42 ^ 0x63);
});

test('invalid seeds, unimplemented axes and incompatible Scenario data fail loudly', () => {
  for (const seed of [-1, 1.5, Number.NaN, Infinity, 0x1_00_00_00_00]) {
    expect(() => shuffleSetup(classic, seed, ['a'])).toThrow('32-bit');
  }
  expect(() => shuffleSetup(classic, 1, ['b'])).toThrow('not implemented');
  expect(() => shuffleSetup(classic, 1, ['a', 'c'])).toThrow('not implemented');
  expect(() => shuffleSetup(classic, 1, ['a', 'a'])).toThrow('unique');
  expect(() =>
    shuffleSetup({ ...classic, object_placements: [] }, 1, ['a'])
  ).toThrow('placement slots');
  expect(() => shuffleSetup({ ...classic, places: [] }, 1, ['a'])).toThrow(
    'missing Place'
  );
  expect(() =>
    shuffleSetup(
      {
        ...classic,
        places: classic.places.map(place => ({
          ...place,
          position: { x: 16, y: 16 }
        }))
      },
      1,
      ['a']
    )
  ).toThrow('distinct tiles');
});

const asset = new URL(
  '../../public/assets/starting-state.json',
  import.meta.url
);
describe.skipIf(!existsSync(asset))('exported Classic Setup', () => {
  test('passes unchanged to createSim and keeps the sim RNG and inventories', () => {
    const raw = JSON.parse(readFileSync(asset, 'utf8'));
    const before = createSim(99, raw);
    for (let seed = 0; seed < 100; seed++) {
      const shuffled = shuffleSetup(raw, seed, ['a']);
      const after = createSim(99, shuffled);
      expect(after.rng).toBe(before.rng);
      expect(after.roster).toEqual(before.roster);
      expect({ ...after, objectPlacements: before.objectPlacements }).toEqual(
        before
      );
      const occupied = new Set(
        after.objectPlacements
          .filter(slot => slot !== null)
          .map(slot => JSON.stringify(tileOf(slot.position)))
      );
      expect(occupied.size).toBe(25);
      after.objectPlacements.slice(0, 25).forEach((slot, i) => {
        expect(
          OBJECT_LIMITS[i]!.places.map(
            index => after.places.find(place => place.index === index)!.position
          )
        ).toContainEqual(slot!.position);
      });
    }
  });
});
