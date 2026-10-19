// The headless, deterministic simulation (ADR-0002). Nothing here may touch
// the DOM, the canvas or the wall clock: it advances by a fixed tick, draws
// from a seeded RNG and keeps all of its state serialisable. The Levels and
// Game Speed live in view/, on top of it. src/sim/tsconfig.json enforces the
// no-DOM rule, and the ESLint config bans non-deterministic APIs here (#15).

export {
  advanceClock,
  calendarDate,
  displayTime,
  formatClock,
  INITIAL_CLOCK,
  QUARTER_HOURS_PER_DAY,
  QUARTER_HOURS_PER_HOUR,
  tickClock,
  type CalendarDate,
  type Clock,
  type DisplayTime
} from './clock';
export {
  canOrder,
  desiredFacing,
  destinationForClick,
  giveOrder,
  paceFor,
  terrainAt,
  tickMovement,
  tileNumberAt,
  type MovementWorld,
  type Tilemap
} from './movement';
export {
  FULL_MAP_DOT_HEIGHT,
  FULL_MAP_DOT_WIDTH,
  fullMapDots,
  type FullMapDot
} from './full-map';
export {
  headingName,
  MIRROR_HEADING,
  MIRROR_ROW_LIMIT,
  mirrorListing,
  type MirrorListing,
  type MirrorRow
} from './mirror';
export { createRng, nextRandom, type RngState } from './rng';
export {
  forcesOf,
  forcesOnMap,
  loadStartingState,
  placeAt,
  placeKindForTile,
  TILE_SIZE,
  tileOf,
  topLeader,
  type Force,
  type Place,
  type PlaceKind,
  type Point,
  type RosterEntry,
  type StartingState,
  type Trigger
} from './starting-state';
export {
  createSim,
  deserializeSim,
  serializeSim,
  tickSim,
  type SimState
} from './state';
