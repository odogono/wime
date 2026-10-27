import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { ROW_DISTANCE } from './combat';
import { nextRandom } from './rng';
import {
  ENCOUNTER_EXCLUSION_ZONES,
  ENCOUNTER_LIMITS,
  NAZGUL_EXCLUSION_ZONES,
  NAZGUL_LIMITS,
  OBJECT_LIMITS
} from './setup-limits';
import { setupAxisRng, shuffleSetup, type SetupData } from './shuffled-setup';
import { tileOf } from './starting-state';
import { createSim, tickSim } from './state';

// Synthetic data: identifiers come from the design table; positions and
// metadata are invented. CI needs no original assets for the invariants.
const classic = {
  marker: { unchanged: true },
  object_placements: OBJECT_LIMITS.map((limit, i) => ({
    object: limit.object,
    position: { x: (i + 1) * 32, y: 32 }
  })),
  places: Array.from(
    new Set([
      ...OBJECT_LIMITS.flatMap(limit => [...limit.places]),
      ...ENCOUNTER_LIMITS.flatMap(limit =>
        limit.areas.flatMap(area => [...area])
      ),
      ...ENCOUNTER_EXCLUSION_ZONES.map(zone => zone.place),
      ...NAZGUL_LIMITS.flatMap(limit => [...limit.places]),
      ...NAZGUL_EXCLUSION_ZONES.map(zone => zone.place)
    ]),
    index => ({
      index,
      // Place 2 is deliberately distant from every candidate in this fixture.
      position: { x: index === 2 ? 16_000 : index * 16, y: 160 }
    })
  ),
  roster: Array.from({ length: 196 }, (_, index) => ({
    encounter:
      index < 152
        ? null
        : {
            area: { bottom: 0, left: 0, right: 0, top: 0 },
            chance: index % 10,
            earliest_day: 0
          },
    index,
    objects: index === 1 ? [0, 4] : [3],
    position: index === 6 ? null : { x: index * 8, y: 480 }
  }))
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

const candidateAreas = (
  setup: SetupData,
  areas: readonly (readonly [number, number])[]
) =>
  areas.map(([from, to]) => {
    const a = tileOf(
      setup.places.find(place => place.index === from)!.position
    );
    const b = tileOf(setup.places.find(place => place.index === to)!.position);
    return {
      bottom: Math.max(a.y, b.y) * 16 + 15,
      left: Math.min(a.x, b.x) * 16,
      right: Math.max(a.x, b.x) * 16 + 15,
      top: Math.min(a.y, b.y) * 16
    };
  });

const expectOutsideOpening = (
  setup: SetupData,
  area: { bottom: number; left: number; right: number; top: number }
) => {
  for (const zone of ENCOUNTER_EXCLUSION_ZONES) {
    const center = tileOf(
      setup.places.find(place => place.index === zone.place)!.position
    );
    const { marginTiles: margin } = zone;
    expect(
      Math.floor(area.right / 16) < center.x - margin ||
        Math.floor(area.left / 16) > center.x + margin ||
        Math.floor(area.bottom / 16) < center.y - margin ||
        Math.floor(area.top / 16) > center.y + margin
    ).toBe(true);
  }
};

const expectEncounterLimits = (setup: SetupData) => {
  for (const limit of ENCOUNTER_LIMITS) {
    const encounter = setup.roster.find(
      entry => entry.index === limit.roster
    )!.encounter!;
    expect(candidateAreas(setup, limit.areas)).toContainEqual(encounter.area);
    expect(Number.isInteger(encounter.earliest_day)).toBe(true);
    expect(encounter.earliest_day).toBeGreaterThanOrEqual(limit.firstDay[0]);
    expect(encounter.earliest_day).toBeLessThanOrEqual(limit.firstDay[1]);
    expectOutsideOpening(setup, encounter.area);
  }
};

test('Encounter limits cover exactly entries 152–195 and have valid candidate areas and days', () => {
  expect(ENCOUNTER_LIMITS.map(limit => limit.roster)).toEqual(
    Array.from({ length: 44 }, (_, i) => 152 + i)
  );
  for (const limit of ENCOUNTER_LIMITS) {
    expect(limit.areas.length).toBeGreaterThan(0);
    expect(new Set(limit.areas.map(area => JSON.stringify(area))).size).toBe(
      limit.areas.length
    );
    const [first, last] = limit.firstDay;
    expect(Number.isInteger(first) && Number.isInteger(last)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(last).toBeGreaterThanOrEqual(first);
    expect(last).toBeLessThanOrEqual(255);
    for (const area of candidateAreas(classic, limit.areas)) {
      expectOutsideOpening(classic, area);
    }
  }
});

test('1,000 Encounter seeds stay in their areas and days, preserve chance and all other data', () => {
  const before = structuredClone(classic);
  for (let seed = 0; seed < 1000; seed++) {
    const shuffled = shuffleSetup(classic, seed, ['b']);
    expectEncounterLimits(shuffled);
    expect(
      shuffled.roster.map((entry, index) => ({
        ...entry,
        encounter: entry.encounter
          ? {
              ...entry.encounter,
              area: classic.roster[index]!.encounter!.area,
              earliest_day: classic.roster[index]!.encounter!.earliest_day
            }
          : null
      }))
    ).toEqual(classic.roster);
    expect({ ...shuffled, roster: classic.roster }).toEqual(classic);
  }
  expect(classic).toEqual(before);
});

test('Encounter shuffling is deterministic, independent of the object axis and axis order', () => {
  for (const seed of [0, 1, 42, 1234, 0xff_ff_ff_ff]) {
    const a = shuffleSetup(classic, seed, ['a']);
    const b = shuffleSetup(classic, seed, ['b']);
    const both = shuffleSetup(classic, seed, ['a', 'b']);
    expect(shuffleSetup(classic, seed, ['b'])).toEqual(b);
    expect(both.roster).toEqual(b.roster);
    expect(both.object_placements).toEqual(a.object_placements);
    expect(shuffleSetup(classic, seed, ['b', 'a'])).toEqual(both);
    expect(a.roster).toEqual(classic.roster);
    expect(shuffleSetup(classic, seed, [])).toEqual(classic);
  }
  expect(shuffleSetup(classic, 0, ['b'])).not.toEqual(
    shuffleSetup(classic, 1, ['b'])
  );
  const reordered = { ...classic, roster: classic.roster.toReversed() };
  expect(shuffleSetup(reordered, 0, ['b']).roster.toReversed()).toEqual(
    shuffleSetup(classic, 0, ['b']).roster
  );
});

test('Encounter shuffling rejects missing, duplicate or non-Encounter roster entries and missing Places', () => {
  for (const roster of [
    classic.roster.filter(entry => entry.index !== 152),
    classic.roster.map(entry =>
      entry.index === 152 ? { ...entry, index: 153 } : entry
    ),
    classic.roster.map(entry =>
      entry.index === 152 ? { ...entry, encounter: null } : entry
    )
  ]) {
    expect(() => shuffleSetup({ ...classic, roster }, 0, ['b'])).toThrow(
      'Classic roster'
    );
  }
  expect(() => shuffleSetup({ ...classic, places: [] }, 0, ['b'])).toThrow(
    'missing Place'
  );
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
  expect(() => shuffleSetup(classic, 1, ['a', 'd' as 'c'])).toThrow(
    'not implemented'
  );
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

const riderTile = (setup: SetupData, index: number) =>
  tileOf(setup.roster.find(entry => entry.index === index)!.position!);

const expectOutsideRiderZone = (
  setup: SetupData,
  tile: { x: number; y: number }
) => {
  for (const zone of NAZGUL_EXCLUSION_ZONES) {
    const center = tileOf(
      setup.places.find(place => place.index === zone.place)!.position
    );
    expect(
      Math.max(Math.abs(tile.x - center.x), Math.abs(tile.y - center.y))
    ).toBeGreaterThan(zone.marginTiles);
  }
};

const expectNazgulLimits = (setup: SetupData) => {
  for (const limit of NAZGUL_LIMITS) {
    const rider = setup.roster.find(entry => entry.index === limit.roster)!;
    expect(
      limit.places.map(
        index => setup.places.find(place => place.index === index)!.position
      )
    ).toContainEqual(rider.position!);
    expectOutsideRiderZone(setup, riderTile(setup, limit.roster));
  }
};

// Every roster entry with the riders' starts put back.
const withClassicRiders = (setup: SetupData, base: SetupData) =>
  setup.roster.map((entry, index) =>
    entry.index >= 79 && entry.index <= 87
      ? { ...entry, position: base.roster[index]!.position }
      : entry
  );

test('Nazgûl limits cover exactly entries 79–87, each candidate outside the opening zone', () => {
  expect(NAZGUL_LIMITS.map(limit => limit.roster)).toEqual(
    Array.from({ length: 9 }, (_, i) => 79 + i)
  );
  for (const limit of NAZGUL_LIMITS) {
    expect(limit.places.length).toBeGreaterThan(0);
    expect(new Set(limit.places).size).toBe(limit.places.length);
  }
});

test('1,000 Nazgûl seeds keep every rider in its candidates and outside the zone, changing nothing else', () => {
  const before = structuredClone(classic);
  for (let seed = 0; seed < 1000; seed++) {
    const shuffled = shuffleSetup(classic, seed, ['c']);
    expectNazgulLimits(shuffled);
    expect(withClassicRiders(shuffled, classic)).toEqual(classic.roster);
    expect({ ...shuffled, roster: classic.roster }).toEqual(classic);
  }
  expect(classic).toEqual(before);
});

test('with axis c off the Setup is unchanged, and c is independent of a, b and axis order', () => {
  for (const seed of [0, 1, 42, 1234, 0xff_ff_ff_ff]) {
    const ab = shuffleSetup(classic, seed, ['a', 'b']);
    const c = shuffleSetup(classic, seed, ['c']);
    const all = shuffleSetup(classic, seed, ['a', 'b', 'c']);
    expect({ ...all, roster: withClassicRiders(all, classic) }).toEqual(ab);
    expect(all.roster.slice(79, 88)).toEqual(c.roster.slice(79, 88));
    expect(shuffleSetup(classic, seed, ['c', 'b', 'a'])).toEqual(all);
    expect(shuffleSetup(classic, seed, ['c'])).toEqual(c);
  }
  expect(shuffleSetup(classic, 0, ['c'])).not.toEqual(
    shuffleSetup(classic, 1, ['c'])
  );
});

test('Nazgûl shuffling rejects a missing or unplaced rider and missing Places', () => {
  for (const roster of [
    classic.roster.filter(entry => entry.index !== 83),
    classic.roster.map(entry =>
      entry.index === 83 ? { ...entry, position: null } : entry
    )
  ]) {
    expect(() => shuffleSetup({ ...classic, roster }, 0, ['c'])).toThrow(
      'Classic roster'
    );
  }
  expect(() => shuffleSetup({ ...classic, places: [] }, 0, ['c'])).toThrow(
    'missing Place'
  );
});

const asset = new URL(
  '../../public/assets/starting-state.json',
  import.meta.url
);
describe.skipIf(!existsSync(asset))('exported Classic Setup', () => {
  test('every real candidate excludes the opening, and 1,000 seeds load within all Encounter limits', () => {
    const raw = JSON.parse(readFileSync(asset, 'utf8')) as SetupData;
    const before = createSim(99, raw);
    for (const limit of ENCOUNTER_LIMITS) {
      for (const area of candidateAreas(raw, limit.areas)) {
        expectOutsideOpening(raw, area);
      }
    }
    for (let seed = 0; seed < 1000; seed++) {
      const shuffled = shuffleSetup(raw, seed, ['b']);
      expectEncounterLimits(shuffled);
      const after = createSim(99, shuffled);
      expect(
        after.roster.map((entry, index) => ({
          ...entry,
          encounter: entry.encounter
            ? {
                ...entry.encounter,
                area: before.roster[index]!.encounter!.area,
                earliestDay: before.roster[index]!.encounter!.earliestDay
              }
            : null
        }))
      ).toEqual(before.roster);
      expect({ ...after, roster: before.roster }).toEqual(before);
    }
  });

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

  test('every real rider candidate is outside the zone and out of reach of every Good Force, and 1,000 seeds load and tick without a fight', () => {
    const raw = JSON.parse(readFileSync(asset, 'utf8')) as SetupData;
    const before = createSim(99, raw);
    const good = before.roster.filter(
      entry =>
        entry.allegiance !== 0 && entry.position !== null && entry.index <= 78
    );
    for (const limit of NAZGUL_LIMITS) {
      for (const index of limit.places) {
        const at = raw.places.find(place => place.index === index)!.position;
        expectOutsideRiderZone(raw, tileOf(at));
        for (const entry of good) {
          expect(
            Math.abs(entry.position!.x - at.x) > ROW_DISTANCE ||
              Math.abs(entry.position!.y - at.y) > ROW_DISTANCE
          ).toBe(true);
        }
      }
    }
    for (let seed = 0; seed < 1000; seed++) {
      const shuffled = shuffleSetup(raw, seed, ['c']);
      expectNazgulLimits(shuffled);
      const after = createSim(99, shuffled);
      expect(after.rng).toBe(before.rng);
      expect({
        ...after,
        roster: after.roster.map((entry, index) =>
          entry.index >= 79 && entry.index <= 87
            ? { ...entry, position: before.roster[index]!.position }
            : entry
        )
      }).toEqual(before);
      expect(tickSim(after).fight).toBeNull();
    }
  });
});
