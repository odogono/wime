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
  combatRows,
  fightRound,
  findFight,
  finishFight,
  resolveFight,
  setCombatOption,
  startFight,
  type CombatEvent,
  type CombatOption,
  type CombatRow,
  type CombatSide,
  type Fight
} from './combat';
export {
  canOrder,
  desiredFacing,
  destinationForClick,
  giveOrder,
  paceFor,
  sweepMovement,
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
export {
  BARAD_DUR_GARRISON,
  endingAfterFight,
  fallenStrongholds,
  STRONGHOLD_GARRISONS,
  STRONGHOLDS_TO_LOSE,
  type Ending
} from './endings';
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
  restoreSave,
  SAVE_VERSION,
  serialiseSave,
  type RestoreResult,
  type SavedState
} from './save';
export {
  createSim,
  deserializeSim,
  serializeSim,
  takeAnnouncements,
  tickSim,
  type SimState
} from './state';
export {
  GANDALF_REACH,
  GANDALFS,
  RING_BEARER_REACH,
  trigger,
  triggerMet,
  wakeEntry,
  type WakeWorld
} from './wake';
export {
  DAILY_CHECK_HOUR,
  DARK_LORD_MARCHES_DAY,
  dailyWarEvents,
  hasWarEvent,
  INITIAL_WAR_EVENTS,
  isDailyCheck,
  SARUMAN_MARCHES_DAY,
  setWarEvent,
  WAR_EVENT_MESSAGES,
  type WarEventAnnouncement,
  type WarEvents
} from './war-events';
