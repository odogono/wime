import { describe, expect, test } from 'bun:test';

import {
  canOrder,
  desiredFacing,
  destinationForClick,
  giveOrder,
  paceFor,
  takesOrder,
  terrainAt,
  type Tilemap
} from './movement';
import { forcesOf } from './starting-state';
import {
  createSim,
  isHeld,
  releaseWatched,
  tickSim,
  watchEntry,
  type SimState
} from './state';

// The Reference runs of docs/spec/movement.md on synthetic
// maps: the same starting positions, destinations, speed classes
// and stamina as S1-S4, with terrain ratings matching the tiles
// the original was observed on (100 for road and track, 60 for
// plain and woods, 5 for open water). The exported campaign map is
// a gitignored asset, so the maps here are built from those
// ratings; the same runs against the real map are recorded in the
// spec.

const entry = (over: Record<string, unknown>): Record<string, unknown> => ({
  allegiance: 99,
  destination: null,
  encounter: null,
  facing: 0,
  fighting: 4,
  figure: 0,
  health: 7,
  icon: 2,
  index: 0,
  is_unit: false,
  leader: null,
  max_health: 7,
  max_stamina: 40,
  name: '',
  objects: [],
  position: null,
  route: 0,
  speed: 1,
  stamina: 40,
  starting_strength: 1,
  state: 1,
  strength: 1,
  ticked: true,
  trigger: { kind: 'none' },
  trigger_byte: 0,
  unknown: { b19: 0, b24: 0, b29: 0 },
  ...over
});

const place = (
  index: number,
  name: string,
  x: number,
  y: number
): Record<string, unknown> => ({
  announces_attacks: false,
  grid_byte: 50,
  grid_reference: 'B3',
  index,
  name,
  position: { x, y },
  tile: { x: Math.floor(x / 16), y: Math.floor(y / 16) },
  tile_kind: null
});

interface WorldOptions {
  clock?: { day: number; quarterHour: number };
  entries: Record<string, unknown>[];
  height?: number;
  places: Record<string, unknown>[];
  routes?: number[][];
  seed?: number;
  // Tile number for a tile coordinate, and the terrain rating of
  // each tile number used.
  terrainByTile: Record<number, number>;
  tileAt: (tx: number, ty: number) => number;
  width?: number;
}

const makeSim = (options: WorldOptions): SimState => {
  const width = options.width ?? 160;
  const height = options.height ?? 99;
  const indices: number[] = [];
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      indices.push(options.tileAt(tx, ty));
    }
  }
  const tilemap: Tilemap = { height, indices, width };
  const terrainByTile: number[] = [];
  for (const [tile, terrain] of Object.entries(options.terrainByTile)) {
    terrainByTile[Number(tile)] = terrain;
  }
  const clock = options.clock ?? { day: 0, quarterHour: 64 };
  return createSim(
    options.seed ?? 1,
    {
      clock: {
        date: '23 September 1418 S.R.',
        day: clock.day,
        quarter_hour: clock.quarterHour
      },
      events: { event_days: [0], mask: 5, ring_bearer: 1 },
      place_kinds: [],
      places: options.places,
      roster: [entry({ index: 0, ticked: false }), ...options.entries],
      routes: (options.routes ?? []).map((places, index) => ({
        index,
        places
      })),
      terrain_by_tile: terrainByTile
    },
    tilemap
  );
};

const tickUntil = (
  sim: SimState,
  done: (sim: SimState) => boolean,
  maxTicks: number
): SimState => {
  let next = sim;
  for (let i = 0; i < maxTicks && !done(next); i++) {
    next = tickSim(next);
  }
  return next;
};

const withinTolerance = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.15);
};

const tickN = (sim: SimState, n: number): SimState =>
  tickUntil(sim, () => false, n);

// One Leader crossing a uniform map; pace is the distance covered
// over 100 ticks at full speed, stamina 255 so it never rests.
const paceOf = (
  speed: number,
  terrain: number,
  diagonal: boolean
): { manhattan: number; perAxis: number } => {
  const start = { x: 160, y: 160 };
  const destination = diagonal
    ? { x: start.x + 640, y: start.y + 640 }
    : { x: start.x + 640, y: start.y };
  let sim = makeSim({
    entries: [
      entry({
        destination,
        index: 1,
        max_stamina: 255,
        position: start,
        speed,
        stamina: 255
      })
    ],
    places: [place(1, 'START', start.x, start.y)],
    terrainByTile: { 1: terrain },
    tileAt: () => 1
  });
  sim = tickN(sim, 100);
  const end = sim.roster[1]!.position!;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return {
    manhattan: (dx + dy) / 100,
    perAxis: Math.max(dx, dy) / 100
  };
};

describe('S4: terrain pace', () => {
  test('class pace scales by the terrain percentage (tolerance 0.15 px/tick)', () => {
    // finding:movement-terrain-percent-scales-pace. Frodo on the
    // road (100) and Faramir on the track (100) are the sampled
    // rows of the spec; plain and woods rate 60. Runs can sit
    // under the pure rate because a 2-pixel step stops at tile
    // origins (finding:movement-step-moves-to-tile-origin).
    withinTolerance(paceOf(1, 100, false).perAxis, 1.31);
    withinTolerance(paceOf(1, 100, true).perAxis, 0.93);
    withinTolerance(paceOf(3, 100, false).perAxis, 1.62);
    withinTolerance(paceOf(3, 100, true).manhattan, 2.28);
    withinTolerance(paceOf(3, 60, true).perAxis, 0.68);
    withinTolerance(paceOf(4, 60, false).perAxis, 1.08);
    withinTolerance(paceOf(4, 60, true).perAxis, 0.76);
    withinTolerance(paceOf(5, 100, false).perAxis, 2.0);
  });

  test('paceFor is the speed table times terrain over 100', () => {
    const sim = makeSim({
      entries: [entry({ index: 1, position: { x: 0, y: 0 } })],
      places: [place(1, 'X', 0, 0)],
      terrainByTile: { 1: 60 },
      tileAt: () => 1
    });
    expect(paceFor(sim, 4, 60, false)).toBeCloseTo((460 * 60) / 100 / 256, 5);
    expect(terrainAt(sim, { x: 0, y: 0 })).toBe(60);
  });

  test('a 2-pixel step stops at a tile origin', () => {
    // finding:movement-step-moves-to-tile-origin
    let sim = makeSim({
      entries: [
        entry({
          destination: { x: 640, y: 16 },
          facing: 2,
          index: 1,
          max_stamina: 255,
          position: { x: 15, y: 16 },
          speed: 5,
          stamina: 255
        })
      ],
      places: [place(1, 'X', 0, 0)],
      terrainByTile: { 1: 100 },
      tileAt: () => 1
    });
    sim = tickSim(sim);
    expect(sim.roster[1]!.position).toEqual({ x: 16, y: 16 });
  });
});

describe('S1: Frodo towards Bree', () => {
  test('rests exactly where the observed runs rest, followers untouched', () => {
    // Order given day 0 quarter-hour 65 after one tick of Frodo's
    // starting walk south: position (640, 369), stamina 39 of 40,
    // fraction 80 (docs/spec/movement.md S1). The road row is
    // tile row 24 at terrain 100, as is the tile south of Hobbiton.
    let sim = makeSim({
      clock: { day: 0, quarterHour: 65 },
      entries: [
        entry({
          facing: 4,
          fraction: 80,
          index: 1,
          name: 'FRODO',
          position: { x: 640, y: 369 },
          speed: 1,
          stamina: 39
        }),
        entry({
          index: 2,
          leader: 1,
          max_stamina: 32,
          name: 'SAM',
          stamina: 32
        }),
        entry({
          index: 3,
          leader: 1,
          max_stamina: 32,
          name: 'PIPPIN',
          stamina: 32
        })
      ],
      places: [place(2, 'HOBBITON', 640, 368), place(16, 'BREE', 784, 384)],
      terrainByTile: { 1: 100, 2: 60 },
      tileAt: (_tx, ty) => (ty === 23 || ty === 24 ? 1 : 2)
    });
    // Clicking inside Bree's tile snaps to Bree's position.
    sim = giveOrder(sim, 1, { x: 790, y: 390 });
    expect(sim.roster[1]!.destination).toEqual({ x: 784, y: 384 });

    sim = tickUntil(sim, s => s.roster[1]!.state === 3, 96);
    expect(sim.roster[1]!.position).toEqual({ x: 673, y: 384 });
    expect(sim.roster[1]!.stamina).toBe(0);

    // Through the rest and the next day's march to the second rest.
    sim = tickUntil(sim, s => s.roster[1]!.state === 1, 96 * 2);
    sim = tickUntil(sim, s => s.roster[1]!.state === 3, 96);
    expect(sim.roster[1]!.position).toEqual({ x: 724, y: 384 });

    // Followers spend no stamina and hold no position
    // (finding:movement-rest-when-leader-stamina-empty).
    for (const follower of [sim.roster[2]!, sim.roster[3]!]) {
      expect(follower.stamina).toBe(32);
      expect(follower.position).toBeNull();
    }
  });
});

describe('S2: Faramir to Osgiliath', () => {
  test('rests at (1648, 1141) and arrives day 1 quarter-hour 57 ± 8 at leader pace', () => {
    // The Ithilien track is the tile column at x = 1648 (terrain
    // 100); the woods around it rate 60. The Rangers (class 2)
    // follow Faramir (class 3) without slowing him
    // (finding:movement-mixed-force-at-leader-pace).
    let sim = makeSim({
      clock: { day: 0, quarterHour: 72 },
      entries: [
        entry({
          index: 1,
          max_stamina: 32,
          name: 'FARAMIR',
          position: { x: 1632, y: 1104 },
          speed: 3,
          stamina: 32
        }),
        entry({
          index: 2,
          is_unit: true,
          leader: 1,
          name: 'Rangers',
          speed: 2,
          starting_strength: 200,
          strength: 200
        })
      ],
      places: [
        place(48, 'NORTH ITHILIEN', 1632, 1104),
        place(46, 'OSGILIATH', 1632, 1184)
      ],
      // A seed whose morning-resume roll falls in the observed
      // quarter-hour 19-25 window; our RNG is not the original's
      // (ADR-0002), so arrival varies by seed within the window
      // the 1-in-10 roll allows.
      seed: 3,
      terrainByTile: { 1: 100, 2: 60 },
      // The track column, and the rated-100 approach tiles
      // (104, 120 in the spec's S4 table) south-west of it into
      // Osgiliath.
      tileAt: (tx, ty) => (tx === 103 || (tx === 102 && ty >= 73) ? 1 : 2)
    });
    sim = giveOrder(sim, 1, { x: 1640, y: 1190 });
    expect(sim.roster[1]!.destination).toEqual({ x: 1632, y: 1184 });

    sim = tickUntil(sim, s => s.roster[1]!.state === 3, 96);
    expect(sim.roster[1]!.position).toEqual({ x: 1648, y: 1141 });

    sim = tickUntil(sim, s => s.roster[1]!.destination === null, 96 * 3);
    expect(sim.roster[1]!.position).toEqual({ x: 1632, y: 1184 });
    expect(sim.roster[1]!.stamina).toBe(1);
    const arrival = sim.clock.day * 96 + sim.clock.quarterHour;
    expect(Math.abs(arrival - (96 + 57))).toBeLessThanOrEqual(8);
    expect(sim.roster[2]!.stamina).toBe(40);
  });
});

describe('S3: Éomer does not reach Edoras', () => {
  test('loops on the east bank keeping its Order for four days', () => {
    // A river column rated 5 at tile x = 82, plain rated 60
    // around it. Greedy steering scores the river tile ahead
    // (100 x 5) under the bank tiles to the side (69 x 60), and
    // the one-in-ten direct step needs terrain at least 10
    // (finding:movement-greedy-tile-steering).
    let sim = makeSim({
      clock: { day: 0, quarterHour: 69 },
      entries: [
        entry({
          index: 1,
          name: 'EOMER',
          position: { x: 1360, y: 960 },
          speed: 4
        }),
        entry({
          index: 2,
          is_unit: true,
          leader: 1,
          name: 'cavalry',
          speed: 4,
          starting_strength: 120,
          strength: 120
        })
      ],
      places: [
        place(42, 'EAST EMNET', 1360, 960),
        place(40, 'EDORAS', 1248, 992)
      ],
      seed: 7,
      terrainByTile: { 1: 60, 2: 5 },
      tileAt: tx => (tx === 82 ? 2 : 1)
    });
    sim = giveOrder(sim, 1, { x: 1250, y: 995 });
    let wentNorth = false;
    for (let i = 0; i < 96 * 4; i++) {
      sim = tickSim(sim);
      const position = sim.roster[1]!.position!;
      // Never across the river column (x < 1312 would be past it).
      expect(position.x).toBeGreaterThan(1311);
      if (position.y < 955) {
        wentNorth = true;
      }
    }
    expect(wentNorth).toBe(true);
    expect(sim.roster[1]!.destination).toEqual({ x: 1248, y: 992 });
    expect(sim.roster[1]!.position!.x).toBeLessThan(1360);
  });
});

const orderWorld = (): SimState =>
  makeSim({
    entries: [
      entry({ facing: 3, index: 1, name: 'A', position: { x: 160, y: 160 } }),
      entry({ index: 2, leader: 1, name: 'B', route: 1 }),
      entry({ index: 3, leader: 2, name: 'C' }),
      entry({ index: 4, leader: 1, name: 'D' }),
      entry({
        allegiance: 0,
        index: 5,
        name: 'EVIL',
        position: { x: 320, y: 160 }
      }),
      entry({
        index: 6,
        name: 'ASLEEP',
        position: { x: 480, y: 160 },
        state: 0
      }),
      entry({
        index: 7,
        is_unit: true,
        leader: 1,
        name: 'UNIT',
        starting_strength: 300,
        strength: 300
      })
    ],
    places: [place(1, 'HOME', 160, 160), place(2, 'AWAY', 640, 320)],
    routes: [[], [2, 1]],
    terrainByTile: { 1: 100 },
    tileAt: () => 1
  });

// The share of `tries` attempts an entry of `allegiance` takes an Order.
const takenShare = (allegiance: number, tries = 2000): number => {
  let world = orderWorld();
  world = {
    ...world,
    roster: world.roster.map(e => (e.index === 1 ? { ...e, allegiance } : e))
  };
  let taken = 0;
  for (let i = 0; i < tries; i++) {
    const result = takesOrder(world, 1);
    world = result.world;
    taken += result.taken ? 1 : 0;
  }
  return taken / tries;
};

describe('orders', () => {
  test('ordering a member splits it and its followers off', () => {
    // finding:forces-ordering-a-follower-splits-it
    const sim = giveOrder(orderWorld(), 2, { x: 645, y: 325 });
    expect(sim.roster[2]!.leader).toBeNull();
    expect(sim.roster[2]!.position).toEqual({ x: 160, y: 160 });
    expect(sim.roster[2]!.facing).toBe(3);
    expect(sim.roster[2]!.destination).toEqual({ x: 640, y: 320 });
    expect(sim.roster[2]!.state).toBe(1);
    expect(sim.routes[1]).toEqual([]);
    const forces = forcesOf(sim.roster);
    expect(
      forces.map(force => force.members.map(member => member.index))
    ).toContainEqual([1, 4, 7]);
    expect(
      forces.map(force => force.members.map(member => member.index))
    ).toContainEqual([2, 3]);
  });

  test('ordering the Leader orders the whole Force; a raw click goes to the tile origin', () => {
    const sim = giveOrder(orderWorld(), 1, { x: 501, y: 207 });
    expect(sim.roster[1]!.destination).toEqual({ x: 496, y: 192 });
    expect(sim.roster[1]!.leader).toBeNull();
    expect(destinationForClick({ x: 645, y: 325 })).toEqual({
      x: 640,
      y: 320
    });
  });

  // finding:movement-orders-accepted-by-allegiance-roll
  test('a Force takes an Order when its allegiance beats a roll of 2 to 97', () => {
    expect(takenShare(99)).toBe(1);
    expect(takenShare(1)).toBe(0);
    expect(takenShare(2)).toBe(0);
    expect(takenShare(70)).toBeCloseTo(68 / 96, 1);
    expect(takenShare(40)).toBeCloseTo(38 / 96, 1);
  });

  test('a Unit that follows someone cannot be ordered on its own', () => {
    // finding:forces-ordering-a-follower-splits-it
    const sim = orderWorld();
    expect(canOrder(sim, 7)).toBe(false);
    expect(giveOrder(sim, 7, { x: 640, y: 320 })).toBe(sim);
    expect(canOrder(sim, 2)).toBe(true);
  });

  test('only active, awake Forces take Orders', () => {
    // finding:movement-only-active-forces-take-orders
    const sim = orderWorld();
    expect(canOrder(sim, 1)).toBe(true);
    expect(canOrder(sim, 5)).toBe(false);
    expect(canOrder(sim, 6)).toBe(false);
    expect(canOrder(sim, 99)).toBe(false);
    expect(giveOrder(sim, 5, { x: 640, y: 320 })).toBe(sim);
  });

  test('desired facing follows the 2-to-1 axis rule', () => {
    const from = { x: 160, y: 160 };
    expect(desiredFacing(from, { x: 320, y: 160 })).toBe(2);
    expect(desiredFacing(from, { x: 320, y: 320 })).toBe(3);
    expect(desiredFacing(from, { x: 176, y: 320 })).toBe(4);
    expect(desiredFacing(from, { x: 0, y: 0 })).toBe(7);
    // Twice the x distance (32) does not beat y (160): due south.
    expect(desiredFacing(from, { x: 176, y: 320 })).toBe(4);
    // Twice the y distance (32) loses to x (160): due east.
    expect(desiredFacing(from, { x: 320, y: 176 })).toBe(2);
  });
});

describe('rest and arrival', () => {
  test('resting regains 2 a tick and only resumes in the morning window', () => {
    // finding:movement-stamina-and-rest
    let sim = makeSim({
      clock: { day: 0, quarterHour: 8 },
      entries: [
        entry({
          destination: { x: 640, y: 160 },
          index: 1,
          position: { x: 160, y: 160 },
          stamina: 36,
          state: 3
        })
      ],
      places: [place(1, 'X', 0, 0)],
      terrainByTile: { 1: 100 },
      tileAt: () => 1
    });
    sim = tickSim(sim);
    expect(sim.roster[1]!.stamina).toBe(38);
    sim = tickN(sim, 12);
    expect(sim.roster[1]!.stamina).toBe(40);
    // Quarter-hour is now 21 at the earliest; it must set off on a
    // morning tick (the clock has advanced past it when seen).
    let resumedAt: number | null = null;
    for (let i = 0; i < 96 * 3 && resumedAt === null; i++) {
      const before = sim.clock.quarterHour;
      sim = tickSim(sim);
      if (sim.roster[1]!.state === 1) {
        resumedAt = before;
      }
    }
    expect(resumedAt).not.toBeNull();
    expect(resumedAt!).toBeGreaterThan(20);
    expect(resumedAt!).toBeLessThan(52);
  });

  test('arrival turns resting and pops the next route stop', () => {
    // finding:movement-arrival-pops-next-route-stop
    let sim = makeSim({
      entries: [
        entry({
          destination: { x: 176, y: 160 },
          facing: 2,
          index: 1,
          position: { x: 160, y: 160 },
          route: 1,
          speed: 5
        })
      ],
      places: [place(1, 'A', 160, 160), place(2, 'B', 640, 320)],
      routes: [[], [2]],
      terrainByTile: { 1: 100 },
      tileAt: () => 1
    });
    sim = tickUntil(sim, s => s.roster[1]!.state === 3, 40);
    expect(sim.roster[1]!.position).toEqual({ x: 176, y: 160 });
    expect(sim.roster[1]!.destination).toEqual({ x: 640, y: 320 });
    expect(sim.routes[1]).toEqual([]);
  });

  test('stamina 255 never drains and class 0 never moves', () => {
    let sim = makeSim({
      entries: [
        entry({
          destination: { x: 640, y: 160 },
          index: 1,
          max_stamina: 255,
          position: { x: 160, y: 160 },
          speed: 2,
          stamina: 255
        }),
        entry({
          destination: { x: 640, y: 320 },
          index: 2,
          position: { x: 160, y: 320 },
          speed: 0
        })
      ],
      places: [place(1, 'X', 0, 0)],
      terrainByTile: { 1: 100 },
      tileAt: () => 1
    });
    sim = tickN(sim, 20);
    expect(sim.roster[1]!.stamina).toBe(255);
    expect(sim.roster[1]!.position!.x).toBeGreaterThan(160);
    expect(sim.roster[2]!.position).toEqual({ x: 160, y: 320 });
    // A class-0 step still charges stamina in the original.
    expect(sim.roster[2]!.stamina).toBe(20);
  });
});

// Two travellers far apart on open road; the Animation Level watches
// the first (docs/spec/animation-level.md).
const watchedWorld = (): SimState =>
  makeSim({
    entries: [
      entry({
        destination: { x: 1600, y: 160 },
        facing: 2,
        index: 1,
        name: 'WATCHED',
        position: { x: 160, y: 160 }
      }),
      entry({
        destination: { x: 1600, y: 960 },
        facing: 2,
        index: 2,
        name: 'OTHER',
        position: { x: 160, y: 960 }
      })
    ],
    places: [place(1, 'HOME', 160, 160)],
    terrainByTile: { 1: 100 },
    tileAt: () => 1
  });

describe('the Animation Level holds the sweep', () => {
  test('at the watched Character when it is due a pixel, until it walks off', () => {
    const start = watchEntry(watchedWorld(), 1);
    const held = tickUntil(start, isHeld, 20);
    expect(isHeld(held)).toBe(true);
    expect(held.sweepFrom).toBe(1);
    // Nothing more moves and the clock stands still while it is held.
    const later = tickN(held, 10);
    expect(later).toEqual(held);
    // The walk-off moves it the held pixel and the sweep runs on.
    const released = releaseWatched(held);
    expect(released.roster[1]!.position!.x).toBe(
      held.roster[1]!.position!.x + 1
    );
    expect(released.sweepFrom).toBe(0);
    expect(released.clock).not.toEqual(held.clock);
  });

  test('a held step draws nothing from the world', () => {
    const start = watchEntry(watchedWorld(), 1);
    const held = tickUntil(start, isHeld, 20);
    const unwatched = tickUntil(
      watchEntry(watchedWorld(), null),
      sim => sim.clock.quarterHour === held.clock.quarterHour,
      20
    );
    expect(held.rng).toEqual(unwatched.rng);
  });

  test('with nobody watched, time stands still', () => {
    const nobody = watchEntry(watchedWorld(), 0);
    expect(isHeld(nobody)).toBe(true);
    expect(tickN(nobody, 5)).toEqual(nobody);
    expect(releaseWatched(nobody)).toEqual(nobody);
  });

  test('a watched Character with nowhere to go never holds it', () => {
    const still = watchEntry(watchedWorld(), 1);
    still.roster[1] = { ...still.roster[1]!, destination: null };
    const ticked = tickN(still, 10);
    expect(isHeld(ticked)).toBe(false);
    expect(ticked.roster[2]!.position!.x).toBeGreaterThan(160);
  });
});
