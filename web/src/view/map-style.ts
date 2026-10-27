// The Map setting: whether the map Levels are drawn from the original's
// tiles (Classic) or as the Atlas map (docs/spec/atlas-map.md). It is
// the player's own preference, kept in the browser, not in saved games.
import type { MapStyle } from './game-menu';

const KEY = 'wime.map-style';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Classic unless Atlas was chosen; a storage that cannot be read is
// Classic too.
export const loadMapStyle = (storage: PreferenceStorage | null): MapStyle => {
  try {
    return storage?.getItem(KEY) === 'atlas' ? 'atlas' : 'classic';
  } catch {
    return 'classic';
  }
};

// Whether the setting was kept; it still applies for this visit if not.
export const saveMapStyle = (
  storage: PreferenceStorage | null,
  style: MapStyle
): boolean => {
  try {
    storage?.setItem(KEY, style);
    return storage !== null;
  } catch {
    return false;
  }
};
