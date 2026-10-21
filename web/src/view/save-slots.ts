import {
  SAVE_VERSION,
  formatClock,
  restoreSave,
  serialiseSave,
  type SimState
} from '../sim/index';

// Several named save slots in localStorage, a departure from the
// original's single Archive file (finding:ui-single-save-slot,
// docs/spec/saving.md). An index under INDEX_KEY lists the slots, so
// they can be listed without parsing every save; each save sits under
// its own key. Kept apart from the windows so the title menu, the
// in-game menu and autosave share it, and tests can pass a fake storage.

export type SlotStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export interface SlotSummary {
  // In-game date (formatClock), or null when the save could not be read.
  gameDate: string | null;
  id: number;
  // Whether this build can load it: saves of another SAVE_VERSION are
  // listed but refused, as restoreSave refuses them.
  loadable: boolean;
  name: string;
  // When it was saved, in ms since the epoch; null for an imported
  // Archive save, whose time was never recorded.
  savedAt: number | null;
}

export type SlotFailure =
  'full' | 'invalid' | 'missing' | 'other-version' | 'unavailable';

export type SlotResult<T> =
  { ok: true; value: T } | { ok: false; reason: SlotFailure };

interface SlotEntry {
  gameDate: string | null;
  id: number;
  name: string;
  savedAt: number | null;
  version: number | null;
}

interface SlotIndex {
  nextId: number;
  slots: SlotEntry[];
}

export const INDEX_KEY = 'wime.slots';
// The single slot saved before named slots; imported once as a slot.
export const LEGACY_ARCHIVE_KEY = 'wime.archive';
export const LEGACY_ARCHIVE_NAME = 'Archive';
const slotKey = (id: number): string => `wime.slot.${id}`;

// localStorage, or null where reading it throws (storage disabled).
export const browserStorage = (): SlotStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const isQuotaError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

const failWith = (error: unknown): { ok: false; reason: SlotFailure } => ({
  ok: false,
  reason: isQuotaError(error) ? 'full' : 'unavailable'
});

const cleanName = (name: string, id: number): string =>
  name.trim() || `Save ${id}`;

const summary = (entry: SlotEntry): SlotSummary => ({
  gameDate: entry.gameDate,
  id: entry.id,
  loadable: entry.version === SAVE_VERSION,
  name: entry.name,
  savedAt: entry.savedAt
});

// The version and in-game date of a serialised save, read without
// restoring it; nulls where the save is not one.
const describeSave = (
  data: string
): { gameDate: string | null; version: number | null } => {
  try {
    const file = JSON.parse(data) as {
      state?: Partial<SimState>;
      version?: unknown;
    } | null;
    const version = typeof file?.version === 'number' ? file.version : null;
    const clock = file?.state?.clock;
    const gameDate =
      clock && typeof clock.day === 'number' ? formatClock(clock) : null;
    return { gameDate, version };
  } catch {
    return { gameDate: null, version: null };
  }
};

export interface SaveSlots {
  list: () => SlotResult<SlotSummary[]>;
  load: (id: number, tilemap: SimState['tilemap']) => SlotResult<SimState>;
  remove: (id: number) => SlotResult<void>;
  rename: (id: number, name: string) => SlotResult<SlotSummary>;
  // Into a new slot.
  save: (name: string, state: SimState) => SlotResult<SlotSummary>;
  saveOver: (id: number, state: SimState) => SlotResult<SlotSummary>;
}

export const createSaveSlots = (
  storage: SlotStorage | null,
  now: () => number = Date.now
): SaveSlots => {
  const writeIndex = (index: SlotIndex): void => {
    storage!.setItem(INDEX_KEY, JSON.stringify(index));
  };

  // Moves an Archive save from before named slots into a slot, once.
  // If it cannot be written, it stays where it was for the next try.
  const importLegacy = (index: SlotIndex): SlotIndex => {
    const data = storage!.getItem(LEGACY_ARCHIVE_KEY);
    if (data === null) {
      return index;
    }
    const id = index.nextId;
    const entry: SlotEntry = {
      ...describeSave(data),
      id,
      name: LEGACY_ARCHIVE_NAME,
      savedAt: null
    };
    const imported = { nextId: id + 1, slots: [...index.slots, entry] };
    try {
      storage!.setItem(slotKey(id), data);
      writeIndex(imported);
    } catch {
      storage!.removeItem(slotKey(id));
      return index;
    }
    storage!.removeItem(LEGACY_ARCHIVE_KEY);
    return imported;
  };

  const readIndex = (): SlotResult<SlotIndex> => {
    if (!storage) {
      return { ok: false, reason: 'unavailable' };
    }
    try {
      const raw = storage.getItem(INDEX_KEY);
      let index: SlotIndex = { nextId: 1, slots: [] };
      if (raw !== null) {
        const parsed = JSON.parse(raw) as Partial<SlotIndex> | null;
        if (typeof parsed?.nextId === 'number' && Array.isArray(parsed.slots)) {
          index = { nextId: parsed.nextId, slots: parsed.slots };
        }
      }
      return { ok: true, value: importLegacy(index) };
    } catch (error) {
      return failWith(error);
    }
  };

  const write = (
    index: SlotIndex,
    entry: SlotEntry,
    data: string,
    isNew: boolean
  ): SlotResult<SlotSummary> => {
    const slots = isNew
      ? [...index.slots, entry]
      : index.slots.map(slot => (slot.id === entry.id ? entry : slot));
    let previous: string | null = null;
    try {
      previous = isNew ? null : storage!.getItem(slotKey(entry.id));
      storage!.setItem(slotKey(entry.id), data);
      writeIndex({ nextId: Math.max(index.nextId, entry.id + 1), slots });
    } catch (error) {
      // Leave the slots as they were.
      try {
        if (previous === null) {
          storage!.removeItem(slotKey(entry.id));
        } else {
          storage!.setItem(slotKey(entry.id), previous);
        }
      } catch {
        // Nothing more can be done; the index still describes the old save.
      }
      return failWith(error);
    }
    return { ok: true, value: summary(entry) };
  };

  const entryFor = (
    state: SimState,
    id: number,
    name: string
  ): { data: string; entry: SlotEntry } => ({
    data: serialiseSave(state),
    entry: {
      gameDate: formatClock(state.clock),
      id,
      name,
      savedAt: now(),
      version: SAVE_VERSION
    }
  });

  const find = (
    id: number
  ): SlotResult<{ entry: SlotEntry; index: SlotIndex }> => {
    const index = readIndex();
    if (!index.ok) {
      return index;
    }
    const entry = index.value.slots.find(slot => slot.id === id);
    return entry
      ? { ok: true, value: { entry, index: index.value } }
      : { ok: false, reason: 'missing' };
  };

  return {
    list: () => {
      const index = readIndex();
      return index.ok
        ? { ok: true, value: index.value.slots.map(summary) }
        : index;
    },

    load: (id, tilemap) => {
      const found = find(id);
      if (!found.ok) {
        return found;
      }
      let data: string | null;
      try {
        data = storage!.getItem(slotKey(id));
      } catch (error) {
        return failWith(error);
      }
      if (data === null) {
        return { ok: false, reason: 'missing' };
      }
      const result = restoreSave(data, tilemap);
      return result.ok
        ? { ok: true, value: result.state }
        : { ok: false, reason: result.reason };
    },

    remove: id => {
      const found = find(id);
      if (!found.ok) {
        return found;
      }
      const { index } = found.value;
      try {
        writeIndex({
          ...index,
          slots: index.slots.filter(slot => slot.id !== id)
        });
        storage!.removeItem(slotKey(id));
      } catch (error) {
        return failWith(error);
      }
      return { ok: true, value: undefined };
    },

    rename: (id, name) => {
      const found = find(id);
      if (!found.ok) {
        return found;
      }
      const { entry, index } = found.value;
      const renamed = { ...entry, name: cleanName(name, id) };
      try {
        writeIndex({
          ...index,
          slots: index.slots.map(slot => (slot.id === id ? renamed : slot))
        });
      } catch (error) {
        return failWith(error);
      }
      return { ok: true, value: summary(renamed) };
    },

    save: (name, state) => {
      const index = readIndex();
      if (!index.ok) {
        return index;
      }
      const id = index.value.nextId;
      const { data, entry } = entryFor(state, id, cleanName(name, id));
      return write(index.value, entry, data, true);
    },

    saveOver: (id, state) => {
      const found = find(id);
      if (!found.ok) {
        return found;
      }
      const { entry, index } = found.value;
      const next = entryFor(state, id, entry.name);
      return write(index, next.entry, next.data, false);
    }
  };
};
