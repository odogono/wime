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
import {
  chooseCrossing,
  type CrossingLeg,
  type MovementRule
} from './crossing-movement';
import { nextRandom, type RngState } from './rng';
import {
  TILE_SIZE,
  tileOf,
  topLeader,
  type Place,
  type Point,
  type RosterEntry
} from './starting-state';
import { terrainOf, type TerrainGrid } from './terrain';
import type { Waterways } from './waterways';

export interface MovementWorld {
  clock: Clock;
  // Each Leader's leg under Crossing movement, by roster index
  // (docs/spec/crossing-movement.md). Absent, as are the rule and the
  // waterways, for Classic movement.
  crossingLegs?: Record<number, CrossingLeg>;
  movementRule?: MovementRule;
  places: Place[];
  rng: RngState;
  roster: RosterEntry[];
  routes: number[][];
  speeds: { diagonal: number[]; straight: number[] };
  terrain: TerrainGrid | null;
  waterways?: Waterways | null;
}

// Facings 0-7 clockwise from north and their one-pixel steps
// (finding:movement-speed-classes).
export const STEP_DX = [0, 1, 1, 1, 0, -1, -1, -1];
export const STEP_DY = [-1, -1, 0, 1, 1, 1, 0, -1];

// Score weight by how far a candidate facing is, in eighths of a
// turn clockwise from the desired facing
// (finding:movement-greedy-tile-steering).
export const STEERING_WEIGHTS = [100, 69, 39, 19, 9, 19, 39, 69];

// The terrain percentage of the Terrain Region under a point.
export const terrainAt = (
  world: Pick<MovementWorld, 'terrain'>,
  point: Point
): number => terrainOf(world.terrain, point);

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

// Pick a new facing at a tile origin, towards `target`. One time in
// ten the desired facing is taken directly when the tile ahead rates
// at least 10, unless the straight step is off;
// otherwise the eight neighbours are scored and the first strict
// maximum wins. A reverse candidate's score is divided by 8, but
// only when the current facing is 0-3 (the original compares
// against facing + 4 unmasked).
const steer = (
  world: MovementWorld,
  entry: RosterEntry,
  roll100: number,
  target: Point,
  straightStep: boolean
): number => {
  const position = entry.position!;
  const desired = desiredFacing(position, target);
  const ahead = {
    x: position.x + TILE_SIZE * STEP_DX[desired]!,
    y: position.y + TILE_SIZE * STEP_DY[desired]!
  };
  if (straightStep && roll100 >= 90 && terrainAt(world, ahead) >= 10) {
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

// The nine Nazgûl and the Ford of Bruinen, where they hide
// (finding:forces-nazgul-hide-at-ford-of-bruinen).
const FIRST_NAZGUL = 79;
const LAST_NAZGUL = 87;
const FORD_OF_BRUINEN = 22;
// The Ring-bearer proximity trigger (finding:ai-trigger-conditions).
const RING_BEARER_TRIGGER = 0x01;

const atFord = (world: MovementWorld, entry: RosterEntry): boolean => {
  const ford = world.places.find(place => place.index === FORD_OF_BRUINEN);
  return (
    ford !== undefined &&
    entry.position !== null &&
    entry.position.x === ford.position.x &&
    entry.position.y === ford.position.y
  );
};

// Arrival (finding:movement-arrival-pops-next-route-stop): turn
// resting and pop the next Default Orders stop, if any. A Nazgûl
// whose orders end at the Ford of Bruinen goes to sleep instead,
// until the Ring-bearer comes near
// (finding:forces-nazgul-hide-at-ford-of-bruinen).
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
  if (
    next === undefined &&
    entry.index >= FIRST_NAZGUL &&
    entry.index <= LAST_NAZGUL &&
    atFord(world, entry)
  ) {
    return {
      ...entry,
      destination: null,
      state: 0,
      trigger: { event_bit: 0, kind: 'near-ring-bearer' },
      triggerByte: RING_BEARER_TRIGGER
    };
  }
  return {
    ...entry,
    destination: place ? { ...place.position } : null,
    state: 3
  };
};

// A moving Leader's leg under Crossing movement, chosen afresh when
// its destination has changed since the last one, by an Order or the
// next route stop; null under Classic movement.
const crossingLeg = (
  world: MovementWorld,
  entry: RosterEntry
): CrossingLeg | null => {
  if (world.movementRule !== 'crossing' || !world.waterways) {
    return null;
  }
  const destination = entry.destination!;
  const leg = world.crossingLegs?.[entry.index];
  if (
    leg &&
    leg.destination.x === destination.x &&
    leg.destination.y === destination.y
  ) {
    return leg;
  }
  const chosen = chooseCrossing(
    world.waterways,
    entry.position!,
    destination,
    []
  );
  world.crossingLegs = { ...world.crossingLegs, [entry.index]: chosen };
  return chosen;
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
  const leg = crossingLeg(world, entry);
  const waypoint = leg?.waypoint ?? null;
  let facing = entry.facing;
  if (tileAligned(entry.position)) {
    const roll = nextRandom(world.rng);
    world.rng = roll.state;
    facing = steer(
      world,
      entry,
      Math.floor(roll.value * 100),
      waypoint ?? entry.destination,
      waypoint === null
    );
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
    if (leg) {
      const { [entry.index]: _done, ...legs } = world.crossingLegs!;
      world.crossingLegs = legs;
    }
    return arrive(world, stepped);
  }
  if (
    leg &&
    waypoint &&
    tileAligned(position) &&
    position.x === waypoint.x &&
    position.y === waypoint.y
  ) {
    // Reaching the waypoint is not an arrival: the Force records the
    // rivers crossed and chooses again from where it stands.
    world.crossingLegs = {
      ...world.crossingLegs,
      [entry.index]: chooseCrossing(
        world.waterways!,
        position,
        entry.destination,
        [...leg.riversCrossed, ...leg.rivers]
      )
    };
  }
  return stepped;
};

// Move ticked Leaders in roster order from entry `from`. After each
// step that moves an entry, `afterStep` may stop the sweep there, as
// a fight does (docs/spec/combat.md); the sweep then reports where it
// stopped so the caller can carry on from the next entry later.
// `beforeStep` runs for every entry just before its step, on the
// sweep's working copy, as the trigger test does
// (finding:ai-trigger-tested-before-the-move). When the step of entry
// `holdAt` would move it a pixel, the sweep stops before it instead,
// moving nothing, and reports `heldAt`: the Animation Level holds the
// sweep at the watched Character until its figures walk off
// (finding:time-animation-level-holds-the-sweep-at-the-watched-character).
export const sweepMovement = <T extends MovementWorld>(
  world: T,
  from: number,
  afterStep?: (world: T, index: number) => T | null,
  beforeStep?: (world: T, index: number) => void,
  holdAt: number | null = null
): { heldAt?: number; stoppedAt: number | null; world: T } => {
  const next = {
    ...world,
    roster: [...world.roster],
    routes: world.routes.map(route => [...route])
  } as T;
  for (let i = from; i < next.roster.length; i++) {
    beforeStep?.(next, i);
    const entry = next.roster[i]!;
    // A held step must leave no trace, so what it draws is kept.
    const rng = next.rng;
    const legs = next.crossingLegs;
    const route = next.routes[entry.route];
    const stepped = tickEntry(next, entry);
    const moved =
      stepped.position !== null &&
      entry.position !== null &&
      (stepped.position.x !== entry.position.x ||
        stepped.position.y !== entry.position.y);
    if (moved && i === holdAt) {
      next.rng = rng;
      if (legs !== next.crossingLegs) {
        next.crossingLegs = legs ?? {};
      }
      if (route) {
        next.routes[entry.route] = route;
      }
      return { heldAt: i, stoppedAt: null, world: next };
    }
    next.roster[i] = stepped;
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

// Where an Order click sends a Force: the clicked pixel rounded down
// to its tile origin, so a click in a Place's tile lands on the Place
// (finding:movement-destination-is-the-clicked-tile).
export const destinationForClick = (click: Point): Point => {
  const tile = tileOf(click);
  return { x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE };
};

// Whether a roster entry can be given an Order: its Force must be
// active and on the map
// (finding:movement-only-active-forces-take-orders), and a Unit that
// follows someone cannot be ordered on its own
// (finding:forces-ordering-a-follower-splits-it).
export const canOrder = (
  world: MovementWorld,
  memberIndex: number
): boolean => {
  const entry = world.roster[memberIndex];
  if (!entry || !entry.ticked) {
    return false;
  }
  if (entry.leader !== null && entry.startingStrength !== 1) {
    return false;
  }
  const leader = topLeader(world.roster, entry);
  return (
    leader.allegiance > 2 && leader.state !== 0 && leader.position !== null
  );
};

// Whether a Force takes an Order when it is picked through
// `memberIndex`: that entry's allegiance must beat a roll of 2 to 97,
// drawn at every attempt, so 99 always obeys and 1 never
// (finding:movement-orders-accepted-by-allegiance-roll). Draws from the
// world's RNG.
export const takesOrder = <T extends MovementWorld>(
  world: T,
  memberIndex: number
): { taken: boolean; world: T } => {
  const next = nextRandom(world.rng);
  const roll = Math.floor(next.value * 96) + 2;
  return {
    taken: (world.roster[memberIndex]?.allegiance ?? 0) > roll,
    world: { ...world, rng: next.state }
  };
};

// Give a movement Order to one member of a Force and everyone who
// follows it, splitting them off when the member is not the Force's
// Leader (finding:forces-ordering-a-follower-splits-it). The member
// loses its Default Orders and takes its top Leader's position and
// facing. Orders to a Force that cannot take them leave the world
// unchanged.
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
  const destination = destinationForClick(click);
  const atDestination =
    leader.position!.x === destination.x &&
    leader.position!.y === destination.y;
  const routes = world.routes[entry.route]?.length
    ? world.routes.map((route, i) => (i === entry.route ? [] : route))
    : world.routes;
  const roster = world.roster.map(candidate => {
    if (candidate.index !== entry.index) {
      return candidate;
    }
    // A split-off member leads its own Force from the old Force's
    // position; followers keep their leader links and so follow it
    // into the new Force.
    return {
      ...candidate,
      destination: atDestination ? null : destination,
      facing: leader.facing,
      leader: null,
      position: { ...leader.position! },
      state: 1
    };
  });
  return { ...world, roster, routes };
};

// The leg a Force is about to walk: from where it stands, through the
// Crossing it heads for first, if any, to its destination
// (docs/spec/atlas-map.md, "Ways"). Positions are tile origins, as the
// roster's are.
export interface Way {
  destination: Point;
  from: Point;
  waypoint: Point | null;
}

// The Crossing a leg from `from` to `destination` heads for first:
// none under Classic movement, the Leader's own leg when it is walking
// this one, otherwise the one the sim would choose for it now.
const waypointFor = (
  world: MovementWorld,
  leaderIndex: number,
  from: Point,
  destination: Point
): Point | null => {
  if (world.movementRule !== 'crossing' || !world.waterways) {
    return null;
  }
  const leg = world.crossingLegs?.[leaderIndex];
  if (
    leg &&
    leg.destination.x === destination.x &&
    leg.destination.y === destination.y
  ) {
    return leg.waypoint;
  }
  return chooseCrossing(world.waterways, from, destination, []).waypoint;
};

// The Way of the Force that a roster entry is in, or null if its
// Leader has nowhere to go.
export const wayOf = (world: MovementWorld, index: number): Way | null => {
  const entry = world.roster[index];
  if (!entry) {
    return null;
  }
  const leader = topLeader(world.roster, entry);
  const { destination, position } = leader;
  if (
    !destination ||
    destination.x === 0 ||
    !position ||
    (position.x === destination.x && position.y === destination.y)
  ) {
    return null;
  }
  return {
    destination: { ...destination },
    from: { ...position },
    waypoint: waypointFor(world, leader.index, position, destination)
  };
};

// The Way an Order to `click` would give a roster entry, as giveOrder
// sets it, or null if the Order would leave it where it stands.
export const orderedWay = (
  world: MovementWorld,
  memberIndex: number,
  click: Point
): Way | null => {
  const entry = world.roster[memberIndex];
  if (!entry) {
    return null;
  }
  const position = topLeader(world.roster, entry).position;
  const destination = destinationForClick(click);
  if (
    !position ||
    (position.x === destination.x && position.y === destination.y)
  ) {
    return null;
  }
  return {
    destination,
    from: { ...position },
    waypoint: waypointFor(world, memberIndex, position, destination)
  };
};
