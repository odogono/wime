import type { Tilemap } from './movement';
import type { SimState } from './state';

// The single saved game (finding:ui-single-save-slot): the simulation
// state without the tilemap, which the view reattaches from the loaded
// assets, plus a version. A save of any other version is refused; there
// is no migration. 0.9.0 wrote version 8, so its saves load while
// SAVE_VERSION stays 8 and are refused with a message once it changes
// (docs/spec/saving.md). Bump SAVE_VERSION by hand whenever the
// saved state's shape changes; save.test.ts pins the shape of each
// version and fails if it changes without a bump.
export const SAVE_VERSION = 8;

export type SavedState = Omit<SimState, 'tilemap'>;

interface SaveFile {
  state: SavedState;
  version: number;
}

export const serialiseSave = (state: SimState): string => {
  const { tilemap: _tilemap, ...saved } = state;
  const file: SaveFile = { state: saved, version: SAVE_VERSION };
  return JSON.stringify(file);
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
  | { ok: true; state: SimState }
  | { ok: false; reason: 'invalid' | 'other-version' };

export const restoreSave = (
  data: string,
  tilemap: Tilemap | null
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
  if (file.version !== SAVE_VERSION) {
    return { ok: false, reason: 'other-version' };
  }
  return { ok: true, state: { ...file.state, tilemap } };
};
