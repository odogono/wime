import {
  DEBUG_VIEW_ORDER,
  NO_DEBUG_VIEWS,
  type DebugViews
} from './debug-views';
import { browserStorage, type SlotStorage } from './save-slots';

// The player's settings (docs/spec/game-menu.md), the port's own: whether
// sound plays, how much of the window the game fills and which Debug
// views are on. Kept in
// localStorage beside the saves, so they outlast a reload.

export type WindowSize = 1 | 0.75 | 0.5;
export const WINDOW_SIZES: readonly WindowSize[] = [1, 0.75, 0.5];

export interface Settings {
  debug: DebugViews;
  size: WindowSize;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  debug: NO_DEBUG_VIEWS,
  size: 1,
  sound: true
};
export const SETTINGS_KEY = 'wime.settings';

export const nextSize = (size: WindowSize): WindowSize =>
  WINDOW_SIZES[(WINDOW_SIZES.indexOf(size) + 1) % WINDOW_SIZES.length]!;

export const sizeLabel = (size: WindowSize): string =>
  size === 1 ? 'Full' : `${size * 100}%`;

// What is stored, or the defaults for what is missing or unreadable.
export const loadSettings = (
  storage: SlotStorage | null = browserStorage()
): Settings => {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) {
      return DEFAULT_SETTINGS;
    }
    const { debug, size, sound } = raw as Partial<
      Record<keyof Settings, unknown>
    >;
    const stored = (
      typeof debug === 'object' && debug !== null ? debug : {}
    ) as Partial<Record<keyof DebugViews, unknown>>;
    return {
      debug: Object.fromEntries(
        DEBUG_VIEW_ORDER.map(key => [key, stored[key] === true])
      ) as unknown as DebugViews,
      size: WINDOW_SIZES.find(s => s === size) ?? DEFAULT_SETTINGS.size,
      sound: typeof sound === 'boolean' ? sound : DEFAULT_SETTINGS.sound
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// Settings that cannot be stored still hold for this visit.
export const saveSettings = (
  settings: Settings,
  storage: SlotStorage | null = browserStorage()
): void => {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or disabled.
  }
};
