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
  LAST_GOOD_ENTRY,
  combatRows,
  glassWatches,
  fightRound,
  findFight,
  findMatch,
  finishFight,
  fightRowCap,
  listFightOnAnimationLevel,
  playedOnAnimationLevel,
  resolveFight,
  setCombatOption,
  startFight,
  type CombatEvent,
  type CombatOption,
  type CombatRow,
  type CombatSide,
  type Fight,
  type Match,
  type MatchWorld,
  type RowListing
} from './combat';
export {
  closeCouncil,
  councilDue,
  dayAfterCouncil,
  holdCouncil,
  RIVENDELL,
  type CouncilMessage
} from './council';
export {
  DEMO_VERSION,
  campaignMilestones,
  campaignOver,
  isGoodVictory,
  replayDemo,
  runToEnd,
  sameClock,
  sameMeeting,
  startCampaign,
  startDemo,
  stepCampaign,
  stepDemo,
  type CampaignResult,
  type CampaignRun,
  type Command,
  type DemoAssets,
  type DemoInput,
  type DemoPlan,
  type DemoRun,
  type DemoScript,
  type Milestones,
  type ObjectCommand,
  type Player
} from './demo';
export {
  BILBO,
  FIRST_ENCOUNTER,
  isEncounter,
  LAST_ENCOUNTER,
  openBilbo,
  type Passing
} from './encounters';
export {
  answerMeeting,
  MEETING_TIMEOUT_FRAMES,
  meetingBetween,
  startMeeting,
  type Meeting,
  type MeetingAnswer,
  type MeetingKind
} from './meetings';
export {
  canOrder,
  takesOrder,
  desiredFacing,
  destinationForClick,
  giveOrder,
  paceFor,
  sweepMovement,
  terrainAt,
  tickMovement,
  type MovementWorld
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
  statusLine,
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
export {
  dropObjects,
  OBJECT_PLACEMENT_COUNT,
  OBJECTS,
  putDownList,
  putDownObject,
  RING,
  TAKE_LIST_LIMIT,
  takeList,
  takeObject,
  type ObjectPlacement
} from './objects';
export {
  BARAD_DUR,
  MOUNT_DOOM,
  passRingAfterFight,
  ringAtBaradDur,
  ringAtMountDoom
} from './ring';
export {
  TOKENS,
  usableList,
  applyObject,
  VISION_TEXT,
  type UseOutcome
} from './use';
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
  readSaveSetup,
  restoreSave,
  SAVE_VERSION,
  serialiseSave,
  type RestoreResult,
  type SavedState,
  type SaveSetup
} from './save';
export {
  createSim,
  deserializeSim,
  serializeSim,
  takeAnnouncement,
  takePassing,
  isHeld,
  releaseWatched,
  tickSim,
  watchEntry,
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
  ISEN_FORD,
  MORDOR_APPROACHES,
  tripwires,
  SARUMAN_MARCHES_DAY,
  setWarEvent,
  WAR_EVENT_MESSAGES,
  type WarEventAnnouncement,
  type WarEvents
} from './war-events';

export { OBJECT_LIMITS, type ObjectLimit } from './setup-limits';
export {
  SETUP_AXES,
  SHUFFLED_SETUP_AXES,
  setupAxisRng,
  shuffleSetup,
  validateSetupAxes,
  type SetupAxis,
  type SetupData
} from './shuffled-setup';
export {
  loadTerrainRegions,
  terrainGridFrom,
  terrainGridOf,
  type TerrainGrid,
  type TerrainRegions
} from './terrain';
