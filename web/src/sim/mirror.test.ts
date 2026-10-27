import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { MIRROR_ROW_LIMIT, headingName, mirrorListing } from './mirror';
import type { Place, RosterEntry } from './starting-state';
import { createSim } from './state';

const entry = (index: number, over: Partial<RosterEntry>): RosterEntry =>
  ({
    destination: { x: 2000, y: 400 },
    leader: null,
    name: `E${index}`,
    position: { x: 1000, y: 400 },
    startingStrength: 1,
    state: 1,
    strength: 1,
    ...over,
    index
  }) as RosterEntry;

const roster = (entries: RosterEntry[]): RosterEntry[] => {
  const all: RosterEntry[] = [];
  for (const one of entries) {
    all[one.index] = one;
  }
  return all;
};

const place = (name: string, x: number, y: number): Place =>
  ({ name, position: { x, y }, tile: { x: x >> 4, y: y >> 4 } }) as Place;

describe('headingName', () => {
  const from = { x: 1000, y: 1000 };

  test('names the eight directions by the signs of the move', () => {
    expect(headingName(from, { x: 1000, y: 900 })).toBe('north');
    expect(headingName(from, { x: 1100, y: 900 })).toBe('northeast');
    expect(headingName(from, { x: 1100, y: 1000 })).toBe('east');
    expect(headingName(from, { x: 1100, y: 1100 })).toBe('southeast');
    expect(headingName(from, { x: 1000, y: 1100 })).toBe('south');
    expect(headingName(from, { x: 900, y: 1100 })).toBe('southwest');
    expect(headingName(from, { x: 900, y: 1000 })).toBe('west');
    expect(headingName(from, { x: 900, y: 900 })).toBe('northwest');
  });

  test('goes straight when one distance is more than twice the other', () => {
    expect(headingName(from, { x: 1210, y: 1100 })).toBe('east');
    expect(headingName(from, { x: 1100, y: 1210 })).toBe('south');
  });
});

describe('mirrorListing', () => {
  test('lists moving Good Leaders and their followers, going to a Place or heading somewhere', () => {
    const listing = mirrorListing(
      roster([
        entry(1, { destination: { x: 1200, y: 400 }, name: 'FRODO' }),
        entry(2, { destination: null, leader: 1, name: 'SAM' }),
        entry(3, { destination: { x: 1000, y: 100 }, name: 'BOROMIR' }),
        entry(4, {
          destination: { x: 1000, y: 700 },
          name: 'cavalry',
          startingStrength: 500,
          strength: 500
        })
      ]),
      [place('BREE', 1200, 400)]
    );
    expect(listing.good).toEqual([
      { follower: false, text: 'FRODO is going to BREE.' },
      { follower: true, text: 'SAM is following FRODO.' },
      { follower: false, text: 'BOROMIR is heading north.' },
      { follower: false, text: '500 cavalry are heading south.' }
    ]);
  });

  test('leaves out sleepers, followers on their own, and Forces standing still', () => {
    const listing = mirrorListing(
      roster([
        entry(1, { state: 0 }),
        entry(2, { destination: null }),
        entry(3, { leader: 5 }),
        entry(4, {})
      ]),
      []
    );
    expect(listing.good.map(row => row.text)).toEqual(['E4 is heading east.']);
  });

  test('lists Evil by name only, merging Units of the same name', () => {
    const listing = mirrorListing(
      roster([
        entry(79, { name: 'the NAZGUL LORD' }),
        entry(90, { name: 'orcs', startingStrength: 300, strength: 300 }),
        entry(91, { name: 'orcs', startingStrength: 200, strength: 200 }),
        entry(92, { destination: null, name: 'trolls', strength: 100 }),
        entry(152, { name: 'a wight' })
      ]),
      []
    );
    expect(listing).toEqual({
      evil: ['The NAZGUL LORD', '500 orcs'],
      good: []
    });
  });

  // finding:ui-galadriels-mirror-row-limits
  test('shows at most 19 Good rows and 20 Evil rows', () => {
    const many = [
      ...Array.from({ length: 30 }, (_, i) => entry(i + 1, {})),
      ...Array.from({ length: 30 }, (_, i) => entry(i + 100, {}))
    ];
    const listing = mirrorListing(roster(many), []);
    expect(listing.good).toHaveLength(MIRROR_ROW_LIMIT);
    expect(listing.evil).toHaveLength(MIRROR_ROW_LIMIT + 1);
  });

  test("lists followers of followers, and merges a follower only with its Leader's", () => {
    const listing = mirrorListing(
      roster([
        entry(1, { name: 'A' }),
        entry(2, {
          destination: null,
          leader: 1,
          name: 'elves',
          strength: 100
        }),
        entry(3, { destination: null, leader: 2, name: 'C' }),
        entry(4, { name: 'B' }),
        entry(5, { destination: null, leader: 4, name: 'elves', strength: 50 })
      ]),
      []
    );
    expect(listing.good.map(row => row.text)).toEqual([
      'A is heading east.',
      '100 elves are following A.',
      'C is following elves.',
      'B is heading east.',
      '50 elves are following B.'
    ]);
  });

  test('too many Good rows are listed again without lone follower Characters', () => {
    const listing = mirrorListing(
      roster([
        ...Array.from({ length: 18 }, (_, i) => entry(i + 1, {})),
        entry(30, { destination: null, leader: 1, name: 'GIMLI' }),
        entry(31, {
          destination: null,
          leader: 2,
          name: 'Rangers',
          startingStrength: 50,
          strength: 50
        }),
        entry(32, { destination: null, leader: 3, name: 'LEGOLAS' })
      ]),
      []
    );
    const texts = listing.good.map(row => row.text);
    expect(texts).toHaveLength(MIRROR_ROW_LIMIT);
    expect(texts).toContain('50 Rangers are following E2.');
    expect(texts.join(' ')).not.toContain('Gimli');
  });

  // The exported starting state is gitignored and absent in CI.
  const startingState = '../../public/assets/starting-state.json';
  const startingStatePath = new URL(startingState, import.meta.url);
  test.skipIf(!existsSync(startingStatePath))(
    'matches the original at the start of the game',
    () => {
      const sim = createSim(
        1,
        JSON.parse(readFileSync(startingStatePath, 'utf8'))
      );
      const listing = mirrorListing(sim.roster, sim.places);
      expect(listing.good).toEqual([
        { follower: false, text: 'FRODO is going to GREEN HILLS.' },
        { follower: true, text: 'SAM is following FRODO.' },
        { follower: true, text: 'PIPPIN is following FRODO.' }
      ]);
      expect(listing.evil).toEqual([
        'The NAZGUL LORD',
        'The 2nd NAZGUL',
        'The 3rd NAZGUL',
        'The 4th NAZGUL',
        'The 5th NAZGUL',
        'The 6th NAZGUL',
        'The 7th NAZGUL',
        'The 8th NAZGUL',
        'The 9th NAZGUL'
      ]);
    }
  );
});
