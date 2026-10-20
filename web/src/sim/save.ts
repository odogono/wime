import type { Tilemap } from './movement';
import type { SimState } from './state';

// The single saved game (finding:ui-single-save-slot): the simulation
// state without the tilemap, which the view reattaches from the loaded
// assets, plus a version. A save of any other version is refused; there
// is no migration before 1.0. Bump SAVE_VERSION by hand whenever the
// saved state's shape changes; save.test.ts pins the shape of each
// version and fails if it changes without a bump.
export const SAVE_VERSION = 4;

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
  if (typeof file?.version !== 'number' || typeof file.state !== 'object') {
    return { ok: false, reason: 'invalid' };
  }
  if (file.version !== SAVE_VERSION) {
    return { ok: false, reason: 'other-version' };
  }
  return { ok: true, state: { ...file.state, tilemap } };
};
