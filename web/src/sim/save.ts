import type { SimState } from './state';
import type { TerrainGrid } from './terrain';
import type { Waterways } from './waterways';

// The single saved game (finding:ui-single-save-slot): the simulation
// state without the terrain and waterways, which the view reattaches
// from the loaded assets, plus a version. A save of an older version
// than 9 is refused; there is no migration. 0.9.0 and 1.0.0 wrote version 8; version 9 dropped
// the tile terrain table when the sim moved to the Terrain Regions
// (#297), so their saves are refused with a message
// (docs/spec/saving.md). Version 10 added the Movement rule and the
// Crossing movement legs (docs/spec/crossing-movement.md); a version 9
// save loads as Classic movement, the rule it was played under. Bump SAVE_VERSION by hand whenever the
// saved state's shape changes; save.test.ts pins the shape of each
// version and fails if it changes without a bump.
export const SAVE_VERSION = 10;
const BEFORE_MOVEMENT_RULE = 9;

// Whether this build loads a save of `version`.
export const loadsSaveVersion = (version: number): boolean =>
  version === SAVE_VERSION || version === BEFORE_MOVEMENT_RULE;

export type SavedState = Omit<SimState, 'terrain' | 'waterways'>;

// The Shuffled Setup a game started from (docs/spec/shuffled-setup.md),
// kept beside the state rather than in it, so the sim never reads it.
// A save without one started from the Classic Setup, as every save made
// before Shuffled Setups did, so adding it needed no SAVE_VERSION bump.
export interface SaveSetup {
  seed: number;
}

interface SaveFile {
  setup?: SaveSetup;
  state: SavedState;
  version: number;
}

export const serialiseSave = (
  state: SimState,
  setup: SaveSetup | null = null
): string => {
  const { terrain: _terrain, waterways: _waterways, ...saved } = state;
  const file: SaveFile = {
    ...(setup ? { setup } : {}),
    state: saved,
    version: SAVE_VERSION
  };
  return JSON.stringify(file);
};

// The saved Setup, null for the Classic Setup; undefined when it is
// damaged.
export const readSaveSetup = (setup: unknown): SaveSetup | null | undefined => {
  if (setup === undefined) {
    return null;
  }
  const seed = (setup as Partial<SaveSetup> | null)?.seed;
  return typeof seed === 'number' &&
    Number.isInteger(seed) &&
    seed >= 0 &&
    seed <= 0xff_ff_ff_ff
    ? { seed }
    : undefined;
};

// A shallow check that the saved state is the right kind of object, so
// a damaged save is refused rather than loaded as a broken game.
const looksLikeState = (state: unknown): state is SavedState =>
  typeof state === 'object' &&
  state !== null &&
  Array.isArray((state as Partial<SavedState>).roster) &&
  typeof (state as Partial<SavedState>).clock === 'object' &&
  (state as Partial<SavedState>).clock !== null;

export type RestoreResult =
  | { ok: true; setup: SaveSetup | null; state: SimState }
  | { ok: false; reason: 'invalid' | 'other-version' };

export const restoreSave = (
  data: string,
  terrain: TerrainGrid | null,
  waterways: Waterways | null = null
): RestoreResult => {
  let file: Partial<SaveFile> | null;
  try {
    file = JSON.parse(data) as Partial<SaveFile> | null;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof file?.version !== 'number' || !looksLikeState(file.state)) {
    return { ok: false, reason: 'invalid' };
  }
  if (!loadsSaveVersion(file.version)) {
    return { ok: false, reason: 'other-version' };
  }
  const setup = readSaveSetup(file.setup);
  if (setup === undefined) {
    return { ok: false, reason: 'invalid' };
  }
  const state =
    file.version === BEFORE_MOVEMENT_RULE
      ? {
          ...file.state,
          crossingLegs: {},
          movementRule: 'classic' as const
        }
      : file.state;
  return { ok: true, setup, state: { ...state, terrain, waterways } };
};
