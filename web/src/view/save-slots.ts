import {
  SAVE_VERSION,
  formatClock,
  loadsSaveVersion,
  readSaveSetup,
  restoreSave,
  serialiseSave,
  type SaveSetup,
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
  // Whether this build can load it: saves of a version it cannot load
  // (loadsSaveVersion) are listed but refused, as restoreSave refuses
  // them.
  loadable: boolean;
  name: string;
  // When it was saved, in ms since the epoch; null for an imported
  // Archive save, whose time was never recorded.
  savedAt: number | null;
  // The Shuffled Setup's seed, or null for the Classic Setup.
  setupSeed: number | null;
}

// A loaded game: its state and the Setup it started from.
export interface LoadedGame {
  setup: SaveSetup | null;
  state: SimState;
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
  // Absent from entries written before Shuffled Setups: the Classic Setup.
  setupSeed?: number | null;
  version: number | null;
}

interface SlotIndex {
  // The autosave slot, apart from the named ones: it has no id among
  // them and cannot be renamed.
  autosave?: SlotEntry | undefined;
  nextId: number;
  slots: SlotEntry[];
}

export const INDEX_KEY = 'wime.slots';
// The single slot saved before named slots; imported once as a slot.
export const LEGACY_ARCHIVE_KEY = 'wime.archive';
export const LEGACY_ARCHIVE_NAME = 'Archive';
export const AUTOSAVE_KEY = 'wime.autosave';
export const AUTOSAVE_NAME = 'Autosave';
// The autosave's id in summaries; named slot ids start at 1.
export const AUTOSAVE_ID = 0;
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
  loadable: entry.version !== null && loadsSaveVersion(entry.version),
  name: entry.name,
  savedAt: entry.savedAt,
  setupSeed: entry.setupSeed ?? null
});

// The version, in-game date and Setup seed of a serialised save, read
// without restoring it; nulls where the save is not one.
const describeSave = (
  data: string
): {
  gameDate: string | null;
  setupSeed: number | null;
  version: number | null;
} => {
  try {
    const file = JSON.parse(data) as {
      setup?: unknown;
      state?: Partial<SimState>;
      version?: unknown;
    } | null;
    const version = typeof file?.version === 'number' ? file.version : null;
    const clock = file?.state?.clock;
    const gameDate =
      clock && typeof clock.day === 'number' ? formatClock(clock) : null;
    const setupSeed = readSaveSetup(file?.setup)?.seed ?? null;
    return { gameDate, setupSeed, version };
  } catch {
    return { gameDate: null, setupSeed: null, version: null };
  }
};

// Each save is given the Setup its game started from, null for the
// Classic Setup.
export interface SaveSlots {
  // Over the autosave slot.
  autosave: (
    state: SimState,
    setup: SaveSetup | null
  ) => SlotResult<SlotSummary>;
  // The autosave slot, or null when there is none.
  autosaved: () => SlotResult<SlotSummary | null>;
  // Drops the autosave, as for a game that has ended.
  clearAutosave: () => SlotResult<void>;
  list: () => SlotResult<SlotSummary[]>;
  load: (id: number, terrain: SimState['terrain']) => SlotResult<LoadedGame>;
  loadAutosave: (terrain: SimState['terrain']) => SlotResult<LoadedGame>;
  remove: (id: number) => SlotResult<void>;
  rename: (id: number, name: string) => SlotResult<SlotSummary>;
  // Into a new slot.
  save: (
    name: string,
    state: SimState,
    setup: SaveSetup | null
  ) => SlotResult<SlotSummary>;
  saveOver: (
    id: number,
    state: SimState,
    setup: SaveSetup | null
  ) => SlotResult<SlotSummary>;
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
    const imported = {
      ...index,
      nextId: id + 1,
      slots: [...index.slots, entry]
    };
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
          index = {
            autosave: parsed.autosave,
            nextId: parsed.nextId,
            slots: parsed.slots
          };
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
      writeIndex({
        ...index,
        nextId: Math.max(index.nextId, entry.id + 1),
        slots
      });
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
    setup: SaveSetup | null,
    id: number,
    name: string
  ): { data: string; entry: SlotEntry } => ({
    data: serialiseSave(state, setup),
    entry: {
      gameDate: formatClock(state.clock),
      id,
      name,
      savedAt: now(),
      setupSeed: setup?.seed ?? null,
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

  const loadFrom = (
    key: string,
    terrain: SimState['terrain']
  ): SlotResult<LoadedGame> => {
    let data: string | null;
    try {
      data = storage!.getItem(key);
    } catch (error) {
      return failWith(error);
    }
    if (data === null) {
      return { ok: false, reason: 'missing' };
    }
    const result = restoreSave(data, terrain);
    return result.ok
      ? { ok: true, value: { setup: result.setup, state: result.state } }
      : { ok: false, reason: result.reason };
  };

  return {
    autosave: (state, setup) => {
      const index = readIndex();
      if (!index.ok) {
        return index;
      }
      const { data, entry } = entryFor(
        state,
        setup,
        AUTOSAVE_ID,
        AUTOSAVE_NAME
      );
      let previous: string | null = null;
      try {
        previous = storage!.getItem(AUTOSAVE_KEY);
        storage!.setItem(AUTOSAVE_KEY, data);
        writeIndex({ ...index.value, autosave: entry });
      } catch (error) {
        try {
          if (previous === null) {
            storage!.removeItem(AUTOSAVE_KEY);
          } else {
            storage!.setItem(AUTOSAVE_KEY, previous);
          }
        } catch {
          // The index still describes the old autosave.
        }
        return failWith(error);
      }
      return { ok: true, value: summary(entry) };
    },

    autosaved: () => {
      const index = readIndex();
      if (!index.ok) {
        return index;
      }
      const entry = index.value.autosave;
      return { ok: true, value: entry ? summary(entry) : null };
    },

    clearAutosave: () => {
      const index = readIndex();
      if (!index.ok) {
        return index;
      }
      try {
        writeIndex({ ...index.value, autosave: undefined });
        storage!.removeItem(AUTOSAVE_KEY);
      } catch (error) {
        return failWith(error);
      }
      return { ok: true, value: undefined };
    },

    list: () => {
      const index = readIndex();
      return index.ok
        ? { ok: true, value: index.value.slots.map(summary) }
        : index;
    },

    load: (id, terrain) => {
      const found = find(id);
      return found.ok ? loadFrom(slotKey(id), terrain) : found;
    },

    loadAutosave: terrain => {
      const index = readIndex();
      if (!index.ok) {
        return index;
      }
      return index.value.autosave
        ? loadFrom(AUTOSAVE_KEY, terrain)
        : { ok: false, reason: 'missing' };
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

    save: (name, state, setup) => {
      const index = readIndex();
      if (!index.ok) {
        return index;
      }
      const id = index.value.nextId;
      const { data, entry } = entryFor(state, setup, id, cleanName(name, id));
      return write(index.value, entry, data, true);
    },

    saveOver: (id, state, setup) => {
      const found = find(id);
      if (!found.ok) {
        return found;
      }
      const { entry, index } = found.value;
      const next = entryFor(state, setup, id, entry.name);
      return write(index, next.entry, next.data, false);
    }
  };
};
