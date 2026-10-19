// Movement Orders and the per-tick movement step
// (docs/spec/movement.md). Steering is the original's greedy
// tile-by-tile scheme, not a search
// (finding:movement-greedy-tile-steering): at tile origins a Leader
// scores its eight neighbouring tiles by terrain percentage times a
// facing weight and follows the best for one tile. Pace is the
// speed-class table scaled by the terrain percentage of the tile
// under the entry's centre
// (finding:movement-terrain-percent-scales-pace).

import type { Clock } from './clock';
import { nextRandom, type RngState } from './rng';
import {
  TILE_SIZE,
  placeAt,
  tileOf,
  topLeader,
  type Place,
  type Point,
  type RosterEntry
} from './starting-state';

// The map grid the sim steers over: tile numbers in row order, as the
// view's tilemap asset carries them. A null tilemap (a clock-only
// game) steers as if every tile were rated 100.
export interface Tilemap {
  height: number;
  indices: number[];
  width: number;
}

export interface MovementWorld {
  clock: Clock;
  places: Place[];
  rng: RngState;
  roster: RosterEntry[];
  routes: number[][];
  speeds: { diagonal: number[]; straight: number[] };
  terrainByTile: number[];
  tilemap: Tilemap | null;
}

// Facings 0-7 clockwise from north and their one-pixel steps
// (finding:movement-speed-classes).
export const STEP_DX = [0, 1, 1, 1, 0, -1, -1, -1];
export const STEP_DY = [-1, -1, 0, 1, 1, 1, 0, -1];

// Score weight by how far a candidate facing is, in eighths of a
// turn clockwise from the desired facing
// (finding:movement-greedy-tile-steering).
export const STEERING_WEIGHTS = [100, 69, 39, 19, 9, 19, 39, 69];

export const tileNumberAt = (tilemap: Tilemap | null, point: Point): number => {
  if (!tilemap) {
    return 0;
  }
  const tile = tileOf(point);
  if (
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= tilemap.width ||
    tile.y >= tilemap.height
  ) {
    return 0;
  }
  return tilemap.indices[tile.y * tilemap.width + tile.x] ?? 0;
};

// The terrain percentage of the tile under a point. Tiles with no
// entry in the table rate 100 so a world without the table still
// moves at the speed-table pace.
export const terrainAt = (
  world: Pick<MovementWorld, 'terrainByTile' | 'tilemap'>,
  point: Point
): number => world.terrainByTile[tileNumberAt(world.tilemap, point)] ?? 100;

// The facing that points from one point toward another under the
// original's axis rule: an axis only counts when twice its distance
// beats the other axis, with ties favouring the y axis.
export const desiredFacing = (from: Point, to: Point): number => {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  const signX = 2 * dx > dy ? Math.sign(to.x - from.x) || 1 : 0;
  const signY = 2 * dy >= dx ? Math.sign(to.y - from.y) || 1 : 0;
  // The table at data+0x421c, indexed by (signY + 1) * 4 + signX.
  const bySign = [7, 0, 1, 0, 6, 0, 2, 0, 5, 4, 3];
  return bySign[(signY + 1) * 4 + signX + 1]!;
};

// Pace in pixels per tick for a speed class on a given terrain
// percentage, before the fraction accumulator rounds it to whole
// pixels over a run of ticks.
export const paceFor = (
  world: Pick<MovementWorld, 'speeds'>,
  speedClass: number,
  terrain: number,
  diagonal: boolean
): number => {
  const row = diagonal ? world.speeds.diagonal : world.speeds.straight;
  return ((row[speedClass] ?? 0) * terrain) / 100 / 256;
};

const tileAligned = (point: Point): boolean =>
  point.x % TILE_SIZE === 0 && point.y % TILE_SIZE === 0;

// Pick a new facing at a tile origin. One time in ten the desired
// facing is taken directly when the tile ahead rates at least 10;
// otherwise the eight neighbours are scored and the first strict
// maximum wins. A reverse candidate's score is divided by 8, but
// only when the current facing is 0-3 (the original compares
// against facing + 4 unmasked).
const steer = (
  world: MovementWorld,
  entry: RosterEntry,
  roll100: number
): number => {
  const position = entry.position!;
  const desired = desiredFacing(position, entry.destination!);
  const ahead = {
    x: position.x + TILE_SIZE * STEP_DX[desired]!,
    y: position.y + TILE_SIZE * STEP_DY[desired]!
  };
  if (roll100 >= 90 && terrainAt(world, ahead) >= 10) {
    return desired;
  }
  let best = 0;
  let bestFacing = entry.facing;
  for (let i = 0; i < 8; i++) {
    const candidate = (desired + i) % 8;
    const tile = {
      x: position.x + TILE_SIZE * STEP_DX[candidate]!,
      y: position.y + TILE_SIZE * STEP_DY[candidate]!
    };
    let score = STEERING_WEIGHTS[i]! * terrainAt(world, tile);
    if (entry.facing + 4 === candidate) {
      score = Math.floor(score / 8);
    }
    if (score > best) {
      best = score;
      bestFacing = candidate;
    }
  }
  return bestFacing;
};

// Arrival (finding:movement-arrival-pops-next-route-stop): turn
// resting and pop the next Default Orders stop, if any.
const arrive = (world: MovementWorld, entry: RosterEntry): RosterEntry => {
  const route = world.routes[entry.route] ?? [];
  const [next, ...rest] = route;
  const place =
    next === undefined
      ? undefined
      : world.places.find(candidate => candidate.index === next);
  if (next !== undefined) {
    world.routes[entry.route] = rest;
  }
  return {
    ...entry,
    destination: place ? { ...place.position } : null,
    state: 3
  };
};

// One entry's movement for a tick, with the RNG rolls it needs drawn
// from the world. Followers never move: the tick skips entries with
// a leader (finding:movement-arrival-pops-next-route-stop).
const tickEntry = (world: MovementWorld, entry: RosterEntry): RosterEntry => {
  if (
    !entry.ticked ||
    entry.state === 0 ||
    entry.state === 2 ||
    entry.leader !== null ||
    entry.destination === null ||
    entry.destination.x === 0 ||
    entry.strength === 0 ||
    entry.position === null
  ) {
    return entry;
  }
  if (entry.state === 3) {
    // Resting: +2 stamina a tick until full, then a 1-in-10 chance
    // to set off in the morning window (quarter-hours 21-51)
    // (finding:movement-stamina-and-rest).
    if (entry.stamina < entry.maxStamina) {
      return { ...entry, stamina: Math.min(255, entry.stamina + 2) };
    }
    const quarterHour = world.clock.quarterHour;
    if (quarterHour > 20 && quarterHour < 52) {
      const roll = nextRandom(world.rng);
      world.rng = roll.state;
      if (Math.floor(roll.value * 10) === 0) {
        return { ...entry, state: 1 };
      }
    }
    return entry;
  }
  if (entry.stamina === 0) {
    // The Force rests when its Leader's stamina reaches 0
    // (finding:movement-rest-when-leader-stamina-empty).
    return { ...entry, state: 3 };
  }
  let facing = entry.facing;
  if (tileAligned(entry.position)) {
    const roll = nextRandom(world.rng);
    world.rng = roll.state;
    facing = steer(world, entry, Math.floor(roll.value * 100));
  }
  const diagonal = facing % 2 === 1;
  const row = diagonal ? world.speeds.diagonal : world.speeds.straight;
  const centre = { x: entry.position.x + 8, y: entry.position.y + 8 };
  const increment = Math.floor(
    ((row[entry.speed] ?? 0) * terrainAt(world, centre)) / 100
  );
  const total = increment + entry.fraction;
  // Stamina is charged for the step even when the fraction does not
  // make a whole pixel (finding:movement-stamina-and-rest).
  const stamina =
    entry.maxStamina < 255 ? Math.max(0, entry.stamina - 1) : entry.stamina;
  const moved: RosterEntry = {
    ...entry,
    facing,
    fraction: total & 0xff,
    stamina
  };
  if (total < 256) {
    return moved;
  }
  const pixels = Math.floor(total / 256);
  let position = {
    x: entry.position.x + STEP_DX[facing]!,
    y: entry.position.y + STEP_DY[facing]!
  };
  // A second pixel is only taken when the first did not land on a
  // tile origin (finding:movement-step-moves-to-tile-origin).
  if (pixels > 1 && !tileAligned(position)) {
    position = {
      x: position.x + STEP_DX[facing]!,
      y: position.y + STEP_DY[facing]!
    };
  }
  const stepped = { ...moved, position };
  if (
    tileAligned(position) &&
    position.x === entry.destination.x &&
    position.y === entry.destination.y
  ) {
    return arrive(world, stepped);
  }
  return stepped;
};

// Move ticked Leaders in roster order from entry `from`. After each
// step that moves an entry, `afterStep` may stop the sweep there, as
// a fight does (docs/spec/combat.md); the sweep then reports where it
// stopped so the caller can carry on from the next entry later.
export const sweepMovement = <T extends MovementWorld>(
  world: T,
  from: number,
  afterStep?: (world: T, index: number) => T | null
): { stoppedAt: number | null; world: T } => {
  const next = {
    ...world,
    roster: [...world.roster],
    routes: world.routes.map(route => [...route])
  } as T;
  for (let i = from; i < next.roster.length; i++) {
    const entry = next.roster[i]!;
    const stepped = tickEntry(next, entry);
    next.roster[i] = stepped;
    const moved =
      stepped.position !== null &&
      entry.position !== null &&
      (stepped.position.x !== entry.position.x ||
        stepped.position.y !== entry.position.y);
    if (moved && afterStep) {
      const stopped = afterStep(next, i);
      if (stopped) {
        return { stoppedAt: i, world: stopped };
      }
    }
  }
  return { stoppedAt: null, world: next };
};

// Move every ticked Leader once, in roster order. The clock is the
// caller's job (tickSim advances it after the sweep, as the
// original did after entry 151).
export const tickMovement = <T extends MovementWorld>(world: T): T =>
  sweepMovement(world, 0).world;

// Where an Order click sends a Force: a Place's own position when
// the click is in its tile
// (finding:movement-destination-snaps-to-place), otherwise the
// clicked tile's origin (provisional; see docs/spec/movement.md).
export const destinationForClick = (places: Place[], click: Point): Point => {
  const place = placeAt(places, click);
  if (place) {
    return { ...place.position };
  }
  const tile = tileOf(click);
  return { x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE };
};

// Whether a roster entry can be given an Order: its Force must be
// active and on the map
// (finding:movement-only-active-forces-take-orders).
export const canOrder = (
  world: MovementWorld,
  memberIndex: number
): boolean => {
  const entry = world.roster[memberIndex];
  if (!entry || !entry.ticked) {
    return false;
  }
  const leader = topLeader(world.roster, entry);
  return (
    leader.allegiance > 2 && leader.state !== 0 && leader.position !== null
  );
};

// Give a movement Order to one member of a Force and everyone who
// follows it, splitting them off when the member is not the Force's
// Leader (finding:movement-ordering-part-of-a-force). Orders to a
// Force that cannot take them leave the world unchanged.
export const giveOrder = <T extends MovementWorld>(
  world: T,
  memberIndex: number,
  click: Point
): T => {
  if (!canOrder(world, memberIndex)) {
    return world;
  }
  const entry = world.roster[memberIndex]!;
  const leader = topLeader(world.roster, entry);
  const destination = destinationForClick(world.places, click);
  const atDestination =
    leader.position!.x === destination.x &&
    leader.position!.y === destination.y;
  const roster = world.roster.map(candidate => {
    if (candidate.index !== entry.index) {
      return candidate;
    }
    return {
      ...candidate,
      destination: atDestination ? null : destination,
      // A split-off member leads its own Force from the old Force's
      // position; followers keep their leader links and so follow
      // it into the new Force.
      leader: candidate.index === leader.index ? candidate.leader : null,
      position:
        candidate.index === leader.index
          ? candidate.position
          : { ...leader.position! },
      state: 1
    };
  });
  return { ...world, roster };
};
