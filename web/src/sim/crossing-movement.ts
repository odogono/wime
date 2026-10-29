// Crossing movement, a port addition (ADR-0008,
// docs/spec/crossing-movement.md): a Force whose way to its destination
// meets a river heads first for a Crossing. Classic movement, the
// original's, never reads anything here.

import { TILE_SIZE, tileOf, type Point } from './starting-state';
import {
  distanceToSegment,
  firstRiverMet,
  riverWithinSquare,
  type Waterways
} from './waterways';

// The game's Movement rule, fixed when the game starts.
export type MovementRule = 'classic' | 'crossing';

// A Crossing within reach may lengthen the way by at most this ratio,
// unless it lies within CROSSING_NEAR_LINE pixels of the direct way.
export const CROSSING_DETOUR_RATIO = 1.5;
export const CROSSING_NEAR_LINE = 64;

// A Force's leg to its destination under Crossing movement: the
// destination it was chosen for, the rivers it has crossed at a
// Crossing on the way, and the Crossing it heads for, if any, with
// the rivers that Crossing is on.
export interface CrossingLeg {
  destination: Point;
  rivers: number[];
  riversCrossed: number[];
  waypoint: Point | null;
}

// Whether a Crossing is on a river: within a tile of its line on each
// axis, as the game measures reach. The Ford of Bruinen lies 15.5
// pixels across but 16.3 straight from the Bruinen's line above the
// confluence there.
const isOn = (river: Point[], crossing: Point): boolean =>
  riverWithinSquare(river, crossing, TILE_SIZE);

// Choose a Force's waypoint from where it stands, for a leg to
// `destination` that has crossed `riversCrossed` so far.
export const chooseCrossing = (
  waterways: Waterways,
  from: Point,
  destination: Point,
  riversCrossed: number[]
): CrossingLeg => {
  const leg: CrossingLeg = {
    destination: { ...destination },
    rivers: [],
    riversCrossed,
    waypoint: null
  };
  // The first river not yet crossed on this leg: a Crossing's tile
  // origin may lie short of its river's line, so the way on from it can
  // meet the river just crossed first.
  const river = firstRiverMet(waterways, from, destination, riversCrossed);
  if (river === null) {
    return leg;
  }
  const line = waterways.rivers[river]!;
  const direct = Math.hypot(destination.x - from.x, destination.y - from.y);
  let best: Point | null = null;
  let bestWay = Infinity;
  for (const crossing of waterways.crossings) {
    if (!isOn(line, crossing)) {
      continue;
    }
    const way =
      Math.hypot(crossing.x - from.x, crossing.y - from.y) +
      Math.hypot(destination.x - crossing.x, destination.y - crossing.y);
    const inReach =
      way <= CROSSING_DETOUR_RATIO * direct ||
      distanceToSegment(crossing, from, destination) <= CROSSING_NEAR_LINE;
    if (inReach && way < bestWay) {
      best = crossing;
      bestWay = way;
    }
  }
  if (!best) {
    return leg;
  }
  const tile = tileOf(best);
  return {
    ...leg,
    // A river's line breaks where another joins it, so a Crossing at a
    // confluence is on each of the lines that meet there.
    rivers: waterways.rivers.flatMap((other, index) =>
      isOn(other, best) ? [index] : []
    ),
    waypoint: { x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE }
  };
};
