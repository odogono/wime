import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import {
  combatRows,
  fightRound,
  findFight,
  finishFight,
  glassWatches,
  listFightOnAnimationLevel,
  playedOnAnimationLevel,
  resolveFight,
  setCombatOption,
  startFight
} from './combat';
import type { Point } from './starting-state';
import { createSim, tickSim, type SimState } from './state';

// Fights on synthetic rosters (docs/spec/combat.md). Entries sit at
// their real roster indices, since the side of an entry is set by
// where it is in the roster (finding:forces-roster-order); every other
// index is an empty, sleeping entry. The reference fights are the
// set-ups of docs/re/combat-reference.md with the original's stats.

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
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

const unit = (
  index: number,
  name: string,
  strength: number,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  index,
  name,
  starting_strength: strength,
  state: 1,
  strength,
  ...over
});

const character = (
  index: number,
  name: string,
  fighting: number,
  health: number,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  fighting,
  health,
  index,
  is_unit: false,
  max_health: health,
  name,
  starting_strength: 1,
  state: 1,
  strength: 1,
  ...over
});

const EVIL = { allegiance: 0 };

const world = (
  entries: Record<string, unknown>[],
  seed = 1,
  routes: number[][] = []
): SimState => {
  const roster = Array.from({ length: 152 }, (_, index) =>
    entry({ index, ticked: index > 0 })
  );
  for (const over of entries) {
    roster[over.index as number] = entry(over);
  }
  return createSim(seed, {
    clock: { day: 0, quarter_hour: 64 },
    events: { ring_bearer: 7 },
    place_kinds: [],
    places: [
      {
        announces_attacks: false,
        grid_byte: 0,
        grid_reference: null,
        index: 1,
        name: 'NOWHERE',
        position: { x: 0, y: 0 },
        tile: { x: 0, y: 0 },
        tile_kind: null
      }
    ],
    roster,
    routes: routes.map((places, index) => ({ index, places }))
  });
};

// Start the fight the Good party's step would start.
const fought = (sim: SimState, mover: number): SimState => {
  const fight = findFight(sim, mover);
  if (!fight) {
    throw new Error('no fight');
  }
  return startFight(sim, fight);
};

const CALEMBEL: Point = { x: 1296, y: 1168 };

const faramir = (seed: number): SimState =>
  fought(
    world(
      [
        character(15, 'FARAMIR', 10, 5, { position: CALEMBEL }),
        unit(16, 'Rangers', 200, { allegiance: 1, leader: 15 }),
        unit(142, 'orcs', 444, { ...EVIL, position: CALEMBEL })
      ],
      seed
    ),
    15
  );

const strengthLost =
  (index: number) =>
  (before: SimState, after: SimState): number =>
    before.roster[index]!.strength - after.roster[index]!.strength;

const eomerAndCavalry = (orcs: number): Record<string, unknown>[] => [
  character(13, 'EOMER', 10, 5, { position: CALEMBEL }),
  unit(14, 'cavalry', 120, { allegiance: 1, fighting: 3, leader: 13 }),
  unit(142, 'orcs', orcs, { ...EVIL, position: CALEMBEL })
];

describe('starting a fight', () => {
  test('a Leader stepping onto a tile origin next to an enemy starts one, and time stops', () => {
    // combat-calembel-ignored: the infantry steps from y 1167 onto
    // Calembel's tile origin, where the orcs stand.
    const sim = world([
      unit(73, 'infantry', 1000, {
        destination: CALEMBEL,
        facing: 4,
        position: { x: 1296, y: 1167 },
        speed: 5
      }),
      unit(141, 'orcs', 500, {
        ...EVIL,
        destination: { x: 1296, y: 1200 },
        position: CALEMBEL
      })
    ]);
    let next = sim;
    for (let i = 0; i < 4 && !next.fight; i++) {
      next = tickSim(next);
    }
    expect(next.fight).toMatchObject({ evil: 141, good: 73 });
    expect(next.roster[73]!.state).toBe(2);
    expect(next.roster[141]!.state).toBe(2);
    expect(next.sweepFrom).toBe(74);
    const frozen = tickSim(next);
    expect(frozen).toBe(next);
  });

  test('two Forces on the same spot do not fight until one steps onto a tile origin', () => {
    // combat-east-emnet: orcs set down on Éomer's tile origin walked
    // off it without a fight.
    const sim = world([
      character(13, 'EOMER', 10, 5, { position: { x: 1360, y: 960 } }),
      unit(142, 'orcs', 500, {
        ...EVIL,
        destination: { x: 1360, y: 1000 },
        position: { x: 1360, y: 960 },
        speed: 5
      })
    ]);
    let next = sim;
    for (let i = 0; i < 4; i++) {
      next = tickSim(next);
    }
    expect(next.roster[142]!.position!.y).toBeGreaterThan(960);
    expect(next.fight).toBeNull();
  });

  test('Evil never fights Evil, and an enemy more than 7 pixels away is not met', () => {
    const sim = world([
      unit(140, 'orcs', 500, { ...EVIL, position: CALEMBEL }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL }),
      unit(73, 'infantry', 1000, { position: { x: 1296, y: 1176 } })
    ]);
    expect(findFight(sim, 141)).toBeNull();
  });

  test('an unmobilised Leader is attacked like any other non-Evil Leader', () => {
    const sim = world([
      unit(61, 'elves', 1000, { allegiance: 1, position: CALEMBEL }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
    ]);
    expect(findFight(sim, 141)).toMatchObject({ evil: 141, good: 61 });
  });

  test('a Character-led Force may evade; a Unit-led one never does', () => {
    const slippery = { unknown: { b19: 0, b24: 0, b29: 210 } };
    const characterLed = world([
      character(77, 'GOLLUM', 3, 3, { ...slippery, position: CALEMBEL }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
    ]);
    expect(findFight(characterLed, 141)).toBeNull();
    const unitLed = world([
      unit(57, 'Rangers', 20, { ...slippery, position: CALEMBEL }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
    ]);
    expect(findFight(unitLed, 141)).not.toBeNull();
  });
});

describe('rows', () => {
  test('Leaders within 9 pixels join with their followers, and like-named Evil Leaders merge', () => {
    const sim = world([
      character(15, 'FARAMIR', 10, 5, { position: CALEMBEL }),
      unit(16, 'Rangers', 200, { allegiance: 1, leader: 15 }),
      unit(73, 'infantry', 1000, { position: { x: 1305, y: 1168 } }),
      unit(74, 'infantry', 800, { position: { x: 1296, y: 1159 } }),
      unit(75, 'infantry', 900, { position: { x: 1306, y: 1168 } }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL }),
      unit(142, 'orcs', 300, { ...EVIL, position: CALEMBEL })
    ]);
    const rows = combatRows(sim.roster, CALEMBEL);
    expect(
      rows.map(row => [row.side, row.entries, row.strength, row.follower])
    ).toEqual([
      ['good', [15], 1, false],
      ['good', [16], 200, true],
      ['good', [73], 1000, false],
      ['good', [74], 800, false],
      ['evil', [141, 142], 800, false]
    ]);
  });

  test('like-named Good Leaders keep rows of their own, and a follower joins the first', () => {
    const sim = world([
      unit(62, 'elves', 400, { position: CALEMBEL }),
      unit(63, 'elves', 300, { position: CALEMBEL }),
      unit(64, 'elves', 500, { leader: 62 }),
      unit(142, 'orcs', 300, { ...EVIL, position: CALEMBEL })
    ]);
    expect(
      combatRows(sim.roster, CALEMBEL).map(row => [row.side, row.entries])
    ).toEqual([
      ['good', [62, 64]],
      ['good', [63]],
      ['evil', [142]]
    ]);
  });
});

// Lone Leaders of distinct names at Calembel, from `first` on.
const leaders = (
  first: number,
  count: number,
  over: Record<string, unknown> = {}
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) =>
    unit(first + i, `troop ${first + i}`, 100, { position: CALEMBEL, ...over })
  );

const rowEntries = (
  rows: { entries: number[]; side: string }[],
  side: string
) => rows.filter(row => row.side === side).map(row => row.entries);

// finding:combat-rows-capped-by-level-and-enemy,
// finding:combat-rows-relisted-without-lone-followers,
// finding:combat-animation-level-lists-the-fight-again
describe('row caps', () => {
  test('a side holds 19 rows on the Campaign Level, and the Evil side one more', () => {
    const sim = world([...leaders(1, 25), ...leaders(100, 25, EVIL)]);
    const rows = combatRows(sim.roster, CALEMBEL);
    expect(rowEntries(rows, 'good')).toHaveLength(19);
    expect(rowEntries(rows, 'evil')).toHaveLength(20);
    expect(rowEntries(rows, 'evil').at(-1)).toEqual([119]);
  });

  test('against a balrog each side holds 7 rows, and the Evil side 8', () => {
    const sim = world([
      ...leaders(1, 10),
      ...leaders(100, 10, EVIL),
      unit(183, 'a balrog', 1, { figure: 12 })
    ]);
    const rows = combatRows(sim.roster, CALEMBEL, {
      animationFight: false,
      enemy: 183,
      level: 'campaign',
      watched: null
    });
    expect(rowEntries(rows, 'good')).toHaveLength(7);
    expect(rowEntries(rows, 'evil')).toHaveLength(8);
  });

  test('too many Good rows are listed again without lone follower Characters', () => {
    const sim = world([
      ...leaders(1, 18),
      character(30, 'GIMLI', 6, 4, { leader: 1 }),
      character(31, 'LEGOLAS', 6, 4, { leader: 2 }),
      unit(32, 'Rangers', 50, { leader: 3 })
    ]);
    const good = rowEntries(combatRows(sim.roster, CALEMBEL), 'good');
    expect(good).toHaveLength(19);
    expect(good.flat()).not.toContain(30);
    expect(good.flat()).not.toContain(31);
    expect(good.flat()).toContain(32);
  });

  test('against Shelob she is the only Evil row', () => {
    const sim = world([
      ...leaders(1, 1),
      unit(150, 'orcs', 100, { ...EVIL, position: CALEMBEL }),
      unit(151, 'SHELOB', 1, { ...EVIL, position: CALEMBEL })
    ]);
    const rows = combatRows(sim.roster, CALEMBEL, {
      animationFight: false,
      enemy: 151,
      level: 'campaign',
      watched: null
    });
    expect(rowEntries(rows, 'evil')).toEqual([[151]]);
  });
});

// Whether a fight started by `mover` is played on the Animation Level.
const fightOf = (entries: Record<string, unknown>[], mover: number) => {
  const sim = fought(world(entries), mover);
  return playedOnAnimationLevel(sim.fight!, sim.roster);
};

describe('a fight on the Animation Level', () => {
  const elsewhere = { x: 1296, y: 1160 };

  test('is listed again around the watched Character: it first, entry 78 left out, 9 rows a side', () => {
    const sim = fought(
      world([
        character(15, 'FARAMIR', 10, 5, { position: elsewhere }),
        ...leaders(1, 12),
        unit(78, 'troop 78', 100, { position: CALEMBEL }),
        ...leaders(100, 12, EVIL)
      ]),
      100
    );
    const listed = listFightOnAnimationLevel(
      {
        ...sim,
        roster: sim.roster.map(entry =>
          entry.index === 15 ? { ...entry, position: CALEMBEL } : entry
        )
      },
      15
    );
    const good = rowEntries(listed.fight!.rows, 'good');
    expect(good).toHaveLength(9);
    expect(good[0]).toEqual([15]);
    expect(good.flat()).not.toContain(78);
    expect(rowEntries(listed.fight!.rows, 'evil')).toHaveLength(10);
  });

  test('against an Encounter, it is the only Evil row', () => {
    const sim = fought(
      world([
        character(15, 'FARAMIR', 10, 5, { position: CALEMBEL }),
        unit(142, 'orcs', 300, { ...EVIL, position: CALEMBEL })
      ]),
      15
    );
    const against = {
      ...sim,
      fight: { ...sim.fight!, evil: 160 },
      roster: [
        ...sim.roster,
        ...Array.from({ length: 9 }, (_, i) => ({
          ...sim.roster[0]!,
          index: 152 + i,
          name: 'a troll',
          strength: 1
        }))
      ]
    };
    const listed = listFightOnAnimationLevel(against, 15);
    expect(rowEntries(listed.fight!.rows, 'evil')).toEqual([[160]]);
  });

  test('is played only when no Good row holds a Unit and Elrond leads none', () => {
    const orcs = unit(142, 'orcs', 300, { ...EVIL, position: CALEMBEL });
    expect(
      fightOf(
        [character(15, 'FARAMIR', 10, 5, { position: CALEMBEL }), orcs],
        15
      )
    ).toBe(true);
    expect(
      fightOf([character(3, 'ELROND', 10, 5, { position: CALEMBEL }), orcs], 3)
    ).toBe(false);
    expect(
      fightOf(
        [
          character(15, 'FARAMIR', 10, 5, { position: CALEMBEL }),
          unit(16, 'Rangers', 200, { leader: 15 }),
          orcs
        ],
        15
      )
    ).toBe(false);
  });
});

describe('the magnifying glass', () => {
  test('watches the lowest-numbered awake Good Leader in reach, not the nearest', () => {
    const sim = world([
      character(15, 'FARAMIR', 10, 5, { position: { x: 1300, y: 1160 } }),
      unit(16, 'Rangers', 200, { allegiance: 1, leader: 15 }),
      unit(73, 'infantry', 1000, { position: CALEMBEL }),
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
    ]);
    expect(glassWatches(sim.roster, CALEMBEL)).toBe(15);
  });

  test('watches nobody with no Good Leader in reach', () => {
    const evilOnly = world([
      unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
    ]);
    expect(glassWatches(evilOnly.roster, CALEMBEL)).toBeNull();
    expect(glassWatches(world([]).roster, CALEMBEL)).toBeNull();
    const asleep = world([
      unit(73, 'infantry', 1000, { position: CALEMBEL, state: 0 })
    ]);
    expect(glassWatches(asleep.roster, CALEMBEL)).toBeNull();
  });
});

describe('rounds', () => {
  test('the same seed gives the same fight', () => {
    expect(resolveFight(faramir(9))).toEqual(resolveFight(faramir(9)));
  });

  test('rounds go on until a side has nothing left', () => {
    let sim = faramir(3);
    let rounds = 0;
    while (sim.fight && !sim.fight.winner) {
      sim = fightRound(sim);
      rounds += 1;
    }
    const fight = sim.fight!;
    expect(fight.round).toBe(rounds);
    const left = (side: string): number =>
      fight.rows
        .filter(row => row.side === side)
        .reduce((sum, row) => sum + row.strength, 0);
    const loser = fight.winner === 'good' ? 'evil' : 'good';
    expect(left(loser)).toBe(0);
    expect(left(fight.winner!)).toBeGreaterThan(0);
  });

  test('a withdrawn row is not struck while no Good row has fallen', () => {
    const sim = fought(
      world([
        unit(73, 'infantry', 1000, { position: CALEMBEL }),
        unit(74, 'cavalry', 500, { position: CALEMBEL }),
        unit(141, 'orcs', 100, { ...EVIL, position: CALEMBEL })
      ]),
      // The orcs step: infantry stepping would meet the cavalry first.
      141
    );
    const withdrawn = setCombatOption(sim, 1, 'withdraw');
    expect(withdrawn.fight!.rows[1]!.option).toBe('withdraw');
    const next = fightRound(withdrawn);
    expect(next.fight!.rows[1]!.strength).toBe(500);
  });

  test('a Charge turns to charged, then back to Engage', () => {
    let sim = fought(
      world([
        unit(73, 'infantry', 2000, { position: CALEMBEL }),
        unit(141, 'orcs', 3000, { ...EVIL, position: CALEMBEL })
      ]),
      73
    );
    sim = setCombatOption(sim, 0, 'charge');
    sim = fightRound(sim);
    expect(sim.fight!.rows[0]!.option).toBe('charged');
    if (!sim.fight!.winner) {
      sim = fightRound(sim);
      expect(['engage', 'gone']).toContain(sim.fight!.rows[0]!.option);
    }
  });

  test('the last Good row fighting cannot withdraw or retreat, and Retreat is final', () => {
    let sim = fought(
      world([
        unit(73, 'infantry', 1000, { position: CALEMBEL }),
        unit(74, 'cavalry', 500, { position: CALEMBEL }),
        unit(141, 'orcs', 100, { ...EVIL, position: CALEMBEL })
      ]),
      // The orcs step: infantry stepping would meet the cavalry first.
      141
    );
    sim = setCombatOption(sim, 0, 'retreat');
    expect(sim.fight!.rows[0]!.option).toBe('retreat');
    expect(setCombatOption(sim, 1, 'withdraw')).toBe(sim);
    expect(setCombatOption(sim, 0, 'engage')).toBe(sim);
    expect(setCombatOption(sim, 2, 'charge')).toBe(sim);
  });
});

describe('the end of a fight', () => {
  test('the dead stop, survivors set off, Evil is healed and orphaned followers lead themselves', () => {
    // A Character Leader who dies while his Unit lives on, against an
    // Evil Character who is wounded but survives.
    const done = resolveFight(
      fought(
        world(
          [
            character(15, 'FARAMIR', 1, 1, {
              destination: { x: 1600, y: 1100 },
              facing: 3,
              position: CALEMBEL
            }),
            unit(16, 'Rangers', 2000, { allegiance: 1, leader: 15, route: 0 }),
            character(103, 'GOTHMOG', 200, 9, {
              ...EVIL,
              max_health: 9,
              position: CALEMBEL
            })
          ],
          4,
          [[1, 1]]
        ),
        15
      )
    );
    expect(done.fight).toBeNull();
    expect(done.roster[15]).toMatchObject({ state: 0, strength: 0 });
    // Evil rows are healed whether they live or die.
    expect(done.roster[103]!.health).toBe(9);
    expect(done.roster[16]).toMatchObject({
      allegiance: 99,
      destination: { x: 1600, y: 1100 },
      facing: 3,
      leader: null,
      position: CALEMBEL,
      state: 1
    });
    expect(done.roster[16]!.strength).toBeGreaterThan(0);
    expect(done.routes[0]).toEqual([]);
  });

  test('a fight is finished only once it has a winner', () => {
    const sim = fought(
      world([
        unit(73, 'infantry', 1000, { position: CALEMBEL }),
        unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
      ]),
      73
    );
    expect(finishFight(sim)).toBe(sim);
  });
});

// The reference fights of docs/re/combat-reference.md, each resolved
// as an ignored fight over many seeds. The original's single outcome
// must fall within the sim's spread (the middle 95%), and its winner
// must win at least a fifth of the time
// (finding:combat-rolls-mix-in-the-frame-counter).
describe('reference fights', () => {
  const SEEDS = 300;

  const spread = (
    entries: Record<string, unknown>[],
    mover: number,
    loss: (before: SimState, after: SimState) => number,
    goodWon: (after: SimState) => boolean
  ): { goodWins: number; high: number; low: number } => {
    const losses: number[] = [];
    let goodWins = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const before = fought(world(entries, seed), mover);
      const after = resolveFight(before);
      losses.push(loss(before, after));
      if (goodWon(after)) {
        goodWins += 1;
      }
    }
    losses.sort((a, b) => a - b);
    return {
      goodWins,
      high: losses[Math.floor(0.975 * (SEEDS - 1))]!,
      low: losses[Math.floor(0.025 * (SEEDS - 1))]!
    };
  };

  test('combat-calembel-ignored: the infantry wins, losing 136', () => {
    const result = spread(
      [
        unit(73, 'infantry', 1000, { position: CALEMBEL }),
        unit(141, 'orcs', 500, { ...EVIL, position: CALEMBEL })
      ],
      73,
      strengthLost(73),
      after => after.roster[141]!.strength === 0
    );
    expect(result.goodWins).toBeGreaterThanOrEqual(SEEDS / 5);
    expect(result.low).toBeLessThanOrEqual(136);
    expect(result.high).toBeGreaterThanOrEqual(136);
  });

  test('combat-east-emnet-ignored: Éomer and his cavalry die, the orcs losing 56', () => {
    const result = spread(
      eomerAndCavalry(500),
      13,
      strengthLost(142),
      after => after.roster[142]!.strength === 0
    );
    expect(SEEDS - result.goodWins).toBeGreaterThanOrEqual(SEEDS / 5);
    expect(result.low).toBeLessThanOrEqual(56);
    expect(result.high).toBeGreaterThanOrEqual(56);
  });

  test('combat-faramir-go-there: Faramir and the Rangers die, the orcs falling from 444 to 178', () => {
    const result = spread(
      [
        character(15, 'FARAMIR', 10, 5, { position: CALEMBEL }),
        unit(16, 'Rangers', 200, { allegiance: 1, fighting: 4, leader: 15 }),
        unit(142, 'orcs', 444, { ...EVIL, position: CALEMBEL })
      ],
      15,
      strengthLost(142),
      after => after.roster[142]!.strength === 0
    );
    expect(SEEDS - result.goodWins).toBeGreaterThanOrEqual(SEEDS / 5);
    expect(result.low).toBeLessThanOrEqual(266);
    expect(result.high).toBeGreaterThanOrEqual(266);
  });

  test('combat-eomer-dies-ignored: Éomer alone dies, the orcs losing 13', () => {
    const result = spread(
      [
        character(13, 'EOMER', 10, 5, { position: CALEMBEL }),
        unit(142, 'orcs', 178, { ...EVIL, position: CALEMBEL })
      ],
      13,
      strengthLost(142),
      after => after.roster[142]!.strength === 0
    );
    expect(SEEDS - result.goodWins).toBeGreaterThanOrEqual(SEEDS / 5);
    expect(result.low).toBeLessThanOrEqual(13);
    expect(result.high).toBeGreaterThanOrEqual(13);
  });
});

// The roster's strengths after the same fight, fought at a Place.
const strengthsAfterFightAt = (position: Point): number[] =>
  resolveFight(
    fought(
      world(
        [
          unit(73, 'infantry', 3000, { position }),
          unit(144, 'orcs', 1000, { ...EVIL, position })
        ],
        7
      ),
      73
    )
  ).roster.map(entry => entry.strength);

const MORANNON = { x: 1744, y: 1008 };
const MINAS_TIRITH = { x: 1616, y: 1184 };
const LORIEN = { x: 1344, y: 656 };

// What a 3,000-strong attacker loses, on average, against 1,000 orcs
// of a given fighting strength.
const attackerLoss = (fighting: number): number => {
  let lost = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const after = resolveFight(
      fought(
        world(
          [
            unit(73, 'infantry', 3000, { position: MORANNON }),
            unit(144, 'orcs', 1000, {
              ...EVIL,
              fighting,
              position: MORANNON
            })
          ],
          seed
        ),
        73
      )
    );
    lost += 3000 - after.roster[73]!.strength;
  }
  return lost / 200;
};

// A Place is defended by whoever is awake near the attacked party; its
// Garrisons count only through their stats
// (finding:combat-place-defended-by-the-forces-near-the-fight,
// finding:combat-no-place-or-terrain-modifier).
describe('garrisons', () => {
  test("a Garrison's fighting strength makes an assault cost more than on troops in the field", () => {
    // The Morannon's orcs fight at 3, orcs in the field at 2.
    expect(attackerLoss(3)).toBeGreaterThan(attackerLoss(2) * 1.2);
  });

  test('a Garrison never starts a fight, though it stands next to the enemy', () => {
    let sim = world([
      unit(73, 'infantry', 3000, { position: { x: 1744, y: 1012 } }),
      unit(144, 'orcs', 10_000, { ...EVIL, position: MORANNON })
    ]);
    for (let i = 0; i < 20; i++) {
      sim = tickSim(sim);
    }
    expect(sim.fight).toBeNull();
    expect(sim.roster[144]!.position).toEqual(MORANNON);
  });

  test('the same fight costs the same wherever it is fought', () => {
    expect(strengthsAfterFightAt(MORANNON)).toEqual(
      strengthsAfterFightAt(CALEMBEL)
    );
  });
});

// Who defends a Place (finding:combat-place-defended-by-the-forces-near-the-fight,
// finding:combat-sleeping-leaders-take-no-part-in-a-fight).
describe('who defends a Place', () => {
  test('a Leader near the Place joins, though it stands off it', () => {
    const sim = world([
      unit(34, 'infantry', 600, { position: MINAS_TIRITH }),
      unit(69, 'infantry', 1000, { position: { x: 1624, y: 1184 } }),
      unit(142, 'orcs', 300, { ...EVIL, position: MINAS_TIRITH })
    ]);
    expect(
      combatRows(sim.roster, MINAS_TIRITH).map(row => row.entries)
    ).toEqual([[34], [69], [142]]);
  });

  test('a sleeping Garrison is neither attacked nor drawn into the fight', () => {
    const sim = world([
      unit(60, 'elves', 500, {
        destination: LORIEN,
        position: { x: 1344, y: 655 },
        state: 0
      }),
      unit(61, 'elves', 1000, {
        destination: LORIEN,
        position: { x: 1344, y: 655 },
        state: 0
      }),
      character(59, 'CELEBORN', 10, 5, { position: LORIEN }),
      unit(142, 'orcs', 300, { ...EVIL, position: LORIEN })
    ]);
    expect(combatRows(sim.roster, LORIEN).map(row => row.entries)).toEqual([
      [59],
      [142]
    ]);
    const asleep = world([
      unit(61, 'elves', 1000, {
        destination: LORIEN,
        position: { x: 1344, y: 655 },
        state: 0
      }),
      unit(142, 'orcs', 300, { ...EVIL, position: LORIEN })
    ]);
    expect(findFight(asleep, 142)).toBeNull();
  });

  // The exported starting state is gitignored and absent in CI.
  const startingStatePath = new URL(
    '../../public/assets/starting-state.json',
    import.meta.url
  );
  const start = (): SimState =>
    createSim(1, JSON.parse(readFileSync(startingStatePath, 'utf8')));

  test.skipIf(!existsSync(startingStatePath))(
    'at the start, Minas Tirith is defended by Denethor, the tower guards and both infantry',
    () => {
      expect(
        combatRows(start().roster, MINAS_TIRITH).map(row => row.entries)
      ).toEqual([[32], [33], [34], [69]]);
    }
  );

  test.skipIf(!existsSync(startingStatePath))(
    'at the start, an Evil Force walking into Lórien finds nobody to fight',
    () => {
      const sim = start();
      const orcs = sim.roster[104]!;
      const roster = sim.roster.map(entry =>
        entry === orcs ? { ...entry, position: LORIEN, state: 1 } : entry
      );
      expect(combatRows(roster, LORIEN)).toEqual([
        expect.objectContaining({ entries: [104], side: 'evil' })
      ]);
      expect(findFight({ ...sim, roster }, 104)).toBeNull();
    }
  );
});
