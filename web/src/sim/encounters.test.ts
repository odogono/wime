import { describe, expect, test } from 'bun:test';

import { findMatch, resolveFight, startFight } from './combat';
import { openBilbo } from './encounters';
import { answerMeeting } from './meetings';
import { nextRandom, type RngState } from './rng';
import { restoreSave, serialiseSave } from './save';
import {
  createSim,
  releaseWatched,
  takePassing,
  tickSim,
  watchEntry,
  type SimState
} from './state';

// Meeting Encounters on synthetic rosters (docs/spec/encounters.md).
// Entries sit at their real roster indices, Encounter figures from
// 152; every other index is an empty, sleeping entry. The map is four
// by four tiles of tile number 1, rated by `terrain`.

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
  is_unit: false,
  leader: null,
  max_health: 1,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 2,
  stamina: 40,
  starting_strength: 1,
  state: 0,
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

// Where the movers stand: a tile origin inside every figure's area.
const AT = { x: 32, y: 32 };

// A Leader standing awake at AT, as if its step had just landed there.
const mover = (
  index: number,
  over: Record<string, unknown> = {}
): Record<string, unknown> => ({
  index,
  name: `MOVER ${index}`,
  position: AT,
  state: 1,
  ...over
});

// An Encounter figure whose area is the whole map, met from day 0 with
// a chance of 100.
const figure = (
  index: number,
  name: string,
  over: Record<string, unknown> = {},
  encounter: Record<string, unknown> = {}
): Record<string, unknown> => ({
  allegiance: 0,
  encounter: {
    area: { bottom: 63, left: 0, right: 63, top: 0 },
    chance: 100,
    earliest_day: 0,
    ...encounter
  },
  index,
  name,
  position: null,
  state: 0,
  ticked: false,
  ...over
});

const world = (
  entries: Record<string, unknown>[],
  { day = 10, seed = 1, terrain = 100 } = {}
): SimState => {
  const roster = Array.from({ length: 196 }, (_, index) =>
    entry({ index, ticked: index > 0 && index < 152 })
  );
  for (const over of entries) {
    roster[over.index as number] = entry(over);
  }
  const sim = createSim(
    seed,
    {
      clock: { day, quarter_hour: 64 },
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
      routes: []
    },
    { height: 4, indices: Array.from({ length: 16 }, () => 1), width: 4 }
  );
  return { ...sim, terrainByTile: [0, terrain] };
};

// The first roll out of n the world's RNG will give.
const firstRoll = (rng: RngState, n: number): number =>
  Math.floor(nextRandom(rng).value * n);

const onAnimationLevel = (sim: SimState, watched: number): SimState =>
  watchEntry(sim, watched);

const ORCS = { fighting: 2, starting_strength: 5, strength: 5 };

// A folk figure, met on tiles rated `terrain`.
const folk = (terrain: number, seed = 1): SimState =>
  world([mover(7), figure(160, 'orcs', { ...ORCS, fighting: 1 })], {
    seed,
    terrain
  });

// An advisor figure with a given chance.
const advisor = (
  index: number,
  name: string,
  chance: number
): Record<string, unknown> =>
  figure(index, name, { allegiance: 3, fighting: 5, strength: 1 }, { chance });

describe('the search for Encounters', () => {
  test('on the Campaign Level it runs only at tile origins', () => {
    const sim = world([
      mover(7, { position: { x: 33, y: 32 } }),
      figure(160, 'orcs', ORCS)
    ]);
    expect(findMatch(sim, 7)).toBeNull();
    expect(
      findMatch(world([mover(7), figure(160, 'orcs', ORCS)]), 7)
    ).toMatchObject({
      fight: { evil: 160, good: 7 }
    });
  });

  test('on the Animation Level it runs on every step', () => {
    const sim = onAnimationLevel(
      world([
        mover(7, { position: { x: 33, y: 32 } }),
        figure(160, 'orcs', ORCS)
      ]),
      7
    );
    expect(findMatch(sim, 7)).toMatchObject({ fight: { evil: 160, good: 7 } });
  });

  test('Evil movers never meet Encounters', () => {
    const sim = world([
      mover(100, { allegiance: 0 }),
      figure(160, 'orcs', ORCS),
      figure(170, 'a Ranger', { allegiance: 1, strength: 200 })
    ]);
    expect(findMatch(sim, 100)).toBeNull();
  });

  test('a Leader met at the same check comes before an Encounter', () => {
    const sim = world([
      mover(7),
      mover(120, { allegiance: 0, name: 'orcs' }),
      figure(160, 'trolls', ORCS)
    ]);
    expect(findMatch(sim, 7)).toMatchObject({ fight: { evil: 120 } });
  });

  test('the chance is out of 50 on the Campaign Level and 100 on the Animation Level', () => {
    for (const [watching, n] of [
      [null, 50],
      [7, 100]
    ] as const) {
      const base = watchEntry(
        world([mover(7), figure(160, 'orcs', ORCS)]),
        watching
      );
      const roll = firstRoll(base.rng, n);
      const at = (chance: number): SimState =>
        watchEntry(
          world([mover(7), figure(160, 'orcs', ORCS, { chance })]),
          watching
        );
      expect(findMatch(at(roll), 7)).not.toBeNull();
      if (roll > 0) {
        expect(findMatch(at(roll - 1), 7)).toBeNull();
      }
    }
  });

  test('a chance of 0 still passes on a roll of 0', () => {
    const seed = Array.from({ length: 1000 }, (_, i) => i).find(
      candidate => firstRoll(world([], { seed: candidate }).rng, 50) === 0
    )!;
    const sim = world([mover(7), figure(160, 'orcs', ORCS, { chance: 0 })], {
      seed
    });
    expect(findMatch(sim, 7)).not.toBeNull();
  });

  test('a figure is met only inside its area and from its first day', () => {
    expect(
      findMatch(
        world([
          mover(7),
          figure(160, 'orcs', ORCS, {
            area: { bottom: 31, left: 0, right: 63, top: 0 }
          })
        ]),
        7
      )
    ).toBeNull();
    expect(
      findMatch(
        world([
          mover(7),
          figure(160, 'orcs', ORCS, {
            area: { bottom: 63, left: 33, right: 63, top: 0 }
          })
        ]),
        7
      )
    ).toBeNull();
    expect(
      findMatch(
        world([mover(7), figure(160, 'orcs', ORCS, { earliest_day: 11 })]),
        7
      )
    ).toBeNull();
    expect(
      findMatch(
        world([mover(7), figure(160, 'orcs', ORCS, { earliest_day: 10 })]),
        7
      )
    ).not.toBeNull();
  });

  test('small figures meet only the Fellowship, large ones only other Forces', () => {
    const trolls = { fighting: 4, starting_strength: 100, strength: 100 };
    expect(
      findMatch(world([mover(13), figure(160, 'orcs', ORCS)]), 13)
    ).toBeNull();
    expect(
      findMatch(world([mover(12), figure(160, 'trolls', trolls)]), 12)
    ).toBeNull();
    expect(
      findMatch(world([mover(13), figure(160, 'trolls', trolls)]), 13)
    ).toMatchObject({
      fight: { evil: 160 }
    });
  });

  test('folk are met only at settlements and on roads', () => {
    expect(findMatch(folk(100), 7)).not.toBeNull();
    expect(findMatch(folk(79), 7)).toBeNull();
    // Rated 80 to 99: on the one-in-two roll after the chance roll.
    const met = Array.from(
      { length: 40 },
      (_, seed) => findMatch(folk(80, seed), 7) !== null
    );
    expect(met).toContain(true);
    expect(met).toContain(false);
    for (let seed = 0; seed < 40; seed++) {
      const second = nextRandom(nextRandom(folk(80, seed).rng).state);
      expect(met[seed]).toBe(Math.floor(second.value * 2) !== 0);
    }
  });
});

describe('an Evil Encounter', () => {
  test('attacks through the fight path, with the figure as an Evil row', () => {
    const sim = world([mover(7), figure(160, 'orcs', ORCS)]);
    const match = findMatch(sim, 7);
    expect(match).toEqual({
      fight: {
        events: [],
        evil: 160,
        good: 7,
        position: AT,
        round: 0,
        rows: [
          expect.objectContaining({ entries: [7], side: 'good' }),
          expect.objectContaining({ entries: [160], side: 'evil', strength: 5 })
        ],
        winner: null
      }
    });
  });

  test('tickSim starts the fight and holds the clock', () => {
    const sim = tickSim(
      world([
        mover(7, { destination: AT, position: { x: 32, y: 33 } }),
        figure(160, 'orcs', ORCS)
      ])
    );
    expect(sim.fight).toMatchObject({ evil: 160, good: 7 });
    expect(sim.roster[7]!.state).toBe(2);
    expect(sim.roster[160]!.state).toBe(0);
  });

  test('may be evaded by a Force of Characters', () => {
    const sim = world([
      mover(7, { unknown: { b19: 0, b24: 0, b29: 100 } }),
      figure(160, 'orcs', ORCS)
    ]);
    expect(findMatch(sim, 7)).toBeNull();
  });

  test('a balrog, or a Force with a Unit, is never evaded', () => {
    const evasive = { unknown: { b19: 0, b24: 0, b29: 100 } };
    expect(
      findMatch(world([mover(7, evasive), figure(183, 'a balrog', ORCS)]), 7)
    ).toMatchObject({ fight: { evil: 183 } });
    const withUnit = world([
      mover(13, {
        ...evasive,
        is_unit: true,
        starting_strength: 200,
        strength: 200
      }),
      figure(160, 'trolls', {
        fighting: 4,
        starting_strength: 100,
        strength: 100
      })
    ]);
    expect(findMatch(withUnit, 13)).toMatchObject({ fight: { evil: 160 } });
  });

  test('a Force with a Unit ignores small Encounters', () => {
    const sim = world([
      mover(7),
      entry({
        index: 14,
        is_unit: true,
        leader: 7,
        starting_strength: 200,
        state: 1,
        strength: 200
      }),
      figure(160, 'orcs', ORCS)
    ]);
    expect(findMatch(sim, 7)).toBeNull();
  });

  test('is never used up: its health is restored after the fight', () => {
    const start = world([
      mover(7, { fighting: 1, health: 1, max_health: 1 }),
      figure(160, 'orcs', { ...ORCS, fighting: 50, health: 40, max_health: 40 })
    ]);
    const match = findMatch(start, 7);
    if (!match || !('fight' in match)) {
      throw new Error('no fight');
    }
    const fought = startFight(start, match.fight);
    const wounded = {
      ...fought,
      roster: fought.roster.map(e =>
        e.index === 160 ? { ...e, health: 3 } : e
      )
    };
    const after = resolveFight(wounded);
    expect(after.fight).toBeNull();
    expect(after.roster[160]).toMatchObject({
      health: 40,
      state: 0,
      strength: 5
    });
    expect(after.roster[160]!.encounter).toEqual(start.roster[160]!.encounter);
  });
});

describe('an anonymous figure', () => {
  const RANGER = { allegiance: 1, fighting: 3, strength: 1 };

  test('passes by the watched Character on the Animation Level, changing nothing', () => {
    const start = onAnimationLevel(
      world([
        mover(7, { destination: AT, position: { x: 32, y: 33 } }),
        figure(170, 'a Ranger', RANGER)
      ]),
      7
    );
    // The step waits for the figures to walk off, then finds the Ranger.
    const held = tickSim(start);
    expect(held.passings).toEqual([]);
    const sim = releaseWatched(held);
    expect(sim.passings).toEqual([{ a: 7, b: 170 }]);
    expect(sim.fight).toBeNull();
    expect(sim.meeting).toBeNull();
    expect(sim.roster[170]).toEqual(start.roster[170]!);
    const taken = takePassing(sim);
    expect(taken.passing).toEqual({ a: 7, b: 170 });
    expect(taken.state.passings).toEqual([]);
  });

  test('is not met on the Campaign Level, nor by anyone but the watched Character', () => {
    expect(
      findMatch(world([mover(7), figure(170, 'a Ranger', RANGER)]), 7)
    ).toBeNull();
    expect(
      findMatch(
        onAnimationLevel(world([mover(7), figure(170, 'a Ranger', RANGER)]), 8),
        7
      )
    ).toBeNull();
  });

  test('the Rohirrim scouts are met anywhere', () => {
    const scouts = {
      allegiance: 1,
      fighting: 3,
      figure: 13,
      starting_strength: 200,
      strength: 200
    };
    expect(
      findMatch(world([mover(13), figure(190, 'Rohirrim scouts', scouts)]), 13)
    ).toEqual({
      passing: { a: 13, b: 190 }
    });
  });

  test('is not met by a Leader that is not mobilised', () => {
    const sim = onAnimationLevel(
      world([mover(7, { allegiance: 3 }), figure(170, 'a Ranger', RANGER)]),
      7
    );
    expect(findMatch(sim, 7)).toBeNull();
  });
});

describe('an advisor', () => {
  test('invites the mover to talk, holding it while the talk is pending', () => {
    const sim = tickSim(
      world([
        mover(7, { destination: AT, position: { x: 32, y: 33 } }),
        advisor(153, 'TOM BOMBADIL', 100)
      ])
    );
    expect(sim.meeting).toEqual({ a: 7, b: 153, kind: 'talk' });
    expect(sim.roster[7]!.state).toBe(2);
    expect(sim.roster[153]!.state).toBe(0);
    expect(tickSim(sim)).toBe(sim);
  });

  test('is used up when met, whatever the answer', () => {
    for (const answer of ['continue-on', 'go-there'] as const) {
      const met = tickSim(
        world([
          mover(7, { destination: AT, position: { x: 32, y: 33 } }),
          advisor(153, 'TOM BOMBADIL', 100)
        ])
      );
      expect(met.roster[153]!.encounter!.chance).toBe(0);
      const { world: answered } = answerMeeting(met, answer);
      expect(answered.meeting).toBeNull();
      expect(answered.roster[7]!.state).toBe(1);
      expect(answered.roster[153]!.state).toBe(0);
      expect(answered.roster[153]!.encounter!.chance).toBe(0);
    }
  });

  test('Radagast comes back 10 to 15 days later', () => {
    const days = new Set<number>();
    for (let seed = 0; seed < 2000; seed++) {
      const sim = world([mover(7), advisor(158, 'RADAGAST', 1)], { seed });
      // A chance of 1 out of 50 passes on a roll of 0 or 1.
      if (firstRoll(sim.rng, 50) > 1) {
        continue;
      }
      expect(findMatch(sim, 7)).toEqual({
        meeting: { a: 7, b: 158, kind: 'talk' }
      });
      const radagast = sim.roster[158]!.encounter!;
      expect(radagast.chance).toBe(1);
      days.add(radagast.earliestDay);
    }
    expect([...days].every(day => day >= 20 && day <= 25)).toBe(true);
    expect(days.size).toBe(6);
  });

  test('Bilbo can be met only after the Council of Elrond', () => {
    const before = world([mover(7), advisor(154, 'BILBO', 0)], { seed: 3 });
    expect(firstRoll(before.rng, 50)).toBeGreaterThan(0);
    expect(findMatch(before, 7)).toBeNull();
    const after = { ...before, roster: openBilbo(before.roster) };
    expect(after.roster[154]!.encounter!.chance).toBe(100);
    expect(findMatch(after, 7)).toEqual({
      meeting: { a: 7, b: 154, kind: 'talk' }
    });
  });
});

describe('saving with Encounters', () => {
  test('a pending talk, a used-up advisor and the watched Character survive a save', () => {
    const met = releaseWatched(
      onAnimationLevel(
        world([
          mover(7, { destination: AT, position: { x: 32, y: 33 } }),
          figure(153, 'TOM BOMBADIL', { allegiance: 3, strength: 1 }),
          figure(
            170,
            'a Ranger',
            { allegiance: 1, fighting: 3, strength: 1 },
            { chance: 0 }
          )
        ]),
        7
      )
    );
    expect(met.meeting).toEqual({ a: 7, b: 153, kind: 'talk' });
    const restored = restoreSave(serialiseSave(met), met.tilemap);
    expect(restored).toEqual({ ok: true, state: met });
    if (!restored.ok) {
      return;
    }
    expect(restored.state.roster[153]!.encounter!.chance).toBe(0);
    expect(restored.state.watching).toBe(7);
    expect(answerMeeting(restored.state, 'continue-on')).toEqual(
      answerMeeting(met, 'continue-on')
    );
  });
});
