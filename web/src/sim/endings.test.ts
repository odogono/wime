import { describe, expect, test } from 'bun:test';

import { findFight, resolveFight, startFight } from './combat';
import { endingAfterFight, fallenStrongholds } from './endings';
import type { RosterEntry } from './starting-state';
import { createSim, tickSim, type SimState } from './state';

// The endings a fight can bring (docs/spec/combat.md, "Endings"), on a
// synthetic roster with the Garrisons at their real indices.

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 1,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 2,
  figure: 0,
  health: 1,
  icon: 0,
  index: 0,
  is_unit: true,
  leader: null,
  max_health: 1,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 2,
  stamina: 40,
  starting_strength: 0,
  state: 0,
  strength: 0,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

const garrison = (
  index: number,
  name: string,
  strength: number,
  position: { x: number; y: number }
): Record<string, unknown> => ({
  index,
  name,
  position,
  starting_strength: 1000,
  state: strength > 0 ? 1 : 0,
  strength
});

const HORNBURG = { x: 1168, y: 960 };

// Minas Tirith's and Edoras's Garrisons already destroyed; the Hornburg's
// standing, with an Evil army on it.
const world = (over: Record<string, unknown>[] = []): SimState => {
  const roster = Array.from({ length: 152 }, (_, index) =>
    entry({ index, ticked: index > 0 })
  );
  for (const e of [
    garrison(33, 'tower guards', 0, { x: 1600, y: 1200 }),
    garrison(61, 'elves', 1000, { x: 1344, y: 655 }),
    garrison(64, 'elves', 500, { x: 1696, y: 239 }),
    garrison(67, 'lt. infantry', 0, { x: 1248, y: 992 }),
    garrison(68, 'lt. infantry', 1000, HORNBURG),
    garrison(148, 'orcs', 9500, { x: 1856, y: 1120 }),
    ...over
  ]) {
    roster[e.index as number] = entry(e);
  }
  return createSim(1, {
    clock: { day: 0, quarter_hour: 64 },
    events: { ring_bearer: 7 },
    place_kinds: [],
    places: [
      {
        announces_attacks: true,
        grid_byte: 1,
        grid_reference: null,
        index: 1,
        name: 'HORNBURG',
        position: HORNBURG,
        tile: { x: 73, y: 60 },
        tile_kind: null
      }
    ],
    roster
  });
};

const roster = (sim: SimState): RosterEntry[] => sim.roster;

describe('endings', () => {
  test('two destroyed Garrisons do not end the game, a third does', () => {
    const sim = world();
    expect(fallenStrongholds(roster(sim))).toBe(2);
    expect(endingAfterFight(roster(sim))).toBeNull();
    const third = sim.roster.map(e =>
      e.index === 64 ? { ...e, strength: 0 } : e
    );
    expect(endingAfterFight(third)).toBe('lost-strongholds');
  });

  test('other Units at a Stronghold do not count', () => {
    const sim = world([garrison(60, 'elves', 0, { x: 1344, y: 655 })]);
    expect(fallenStrongholds(roster(sim))).toBe(2);
  });

  test('destroying the Barad-dûr Garrison wins, unless the Strongholds are lost', () => {
    const sim = world();
    const won = sim.roster.map(e =>
      e.index === 148 ? { ...e, strength: 0 } : e
    );
    expect(endingAfterFight(won)).toBe('won-barad-dur');
    const both = won.map(e => (e.index === 64 ? { ...e, strength: 0 } : e));
    expect(endingAfterFight(both)).toBe('lost-strongholds');
  });

  test('a fight that destroys the third Garrison ends the game, and time stops', () => {
    let sim = world([
      {
        allegiance: 0,
        index: 120,
        name: 'orcs',
        position: HORNBURG,
        starting_strength: 20_000,
        state: 1,
        strength: 20_000
      }
    ]);
    const fight = findFight(sim, 120);
    expect(fight).not.toBeNull();
    sim = resolveFight(startFight(sim, fight!));
    expect(sim.roster[68]!.strength).toBe(0);
    expect(sim.ending).toBe('lost-strongholds');
    expect(tickSim(sim)).toBe(sim);
  });

  test('a fight that leaves the Strongholds standing does not end the game', () => {
    let sim = world([
      {
        allegiance: 0,
        index: 120,
        name: 'orcs',
        position: HORNBURG,
        starting_strength: 10,
        state: 1,
        strength: 10
      }
    ]);
    sim = resolveFight(startFight(sim, findFight(sim, 120)!));
    expect(sim.roster[68]!.strength).toBeGreaterThan(0);
    expect(sim.ending).toBeNull();
  });
});
