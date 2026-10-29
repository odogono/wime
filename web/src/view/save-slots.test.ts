import { describe, expect, test } from 'bun:test';

import {
  SAVE_VERSION,
  createSim,
  formatClock,
  serialiseSave,
  tickSim
} from '../sim/index';
import {
  AUTOSAVE_ID,
  INDEX_KEY,
  LEGACY_ARCHIVE_KEY,
  createSaveSlots,
  type SlotStorage
} from './save-slots';

// An in-memory Storage, optionally full after a number of characters.
const NO_WORLD = { terrain: null, waterways: null };

const fakeStorage = (
  limit = Infinity
): SlotStorage & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  const size = (): number =>
    [...items].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
  return {
    getItem: key => items.get(key) ?? null,
    items,
    removeItem: key => {
      items.delete(key);
    },
    setItem: (key, value) => {
      const before = items.get(key);
      items.set(key, value);
      if (size() > limit) {
        if (before === undefined) {
          items.delete(key);
        } else {
          items.set(key, before);
        }
        throw new DOMException('full', 'QuotaExceededError');
      }
    }
  };
};

const later = (ticks: number) => {
  let sim = createSim(7);
  for (let i = 0; i < ticks; i++) {
    sim = tickSim(sim);
  }
  return sim;
};

describe('save slots', () => {
  test('saves several named slots and lists their name, time and date', () => {
    let time = 1000;
    const slots = createSaveSlots(fakeStorage(), () => time);
    const first = createSim(7);
    const second = later(8);
    slots.save('Before Bree', first, null);
    time = 2000;
    slots.save('  At Bree ', second, null);
    expect(slots.list()).toEqual({
      ok: true,
      value: [
        {
          gameDate: formatClock(first.clock),
          id: 1,
          loadable: true,
          movementRule: 'classic',
          name: 'Before Bree',
          savedAt: 1000,
          setupSeed: null
        },
        {
          gameDate: formatClock(second.clock),
          id: 2,
          loadable: true,
          movementRule: 'classic',
          name: 'At Bree',
          savedAt: 2000,
          setupSeed: null
        }
      ]
    });
  });

  test('loads a slot back to the state it saved', () => {
    const slots = createSaveSlots(fakeStorage());
    const sim = later(5);
    const saved = slots.save('One', sim, null);
    const loaded = saved.ok && slots.load(saved.value.id, sim);
    expect(loaded).toEqual({ ok: true, value: { setup: null, state: sim } });
  });

  test('lists the Movement rule a game is played under', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    const sim = { ...later(5), movementRule: 'crossing' as const };
    expect(slots.save('Crossing', sim, null)).toMatchObject({
      value: { movementRule: 'crossing' }
    });
    expect(createSaveSlots(storage).list()).toMatchObject({
      value: [{ movementRule: 'crossing' }]
    });
    expect(slots.load(1, sim)).toMatchObject({
      value: { state: { movementRule: 'crossing' } }
    });
  });

  test('keeps the Setup a game started from', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    const sim = later(5);
    const saved = slots.save('Shuffled', sim, { seed: 42 });
    expect(saved).toMatchObject({ value: { setupSeed: 42 } });
    expect(slots.load(1, sim)).toEqual({
      ok: true,
      value: { setup: { seed: 42 }, state: sim }
    });
    slots.autosave(sim, { seed: 7 });
    expect(createSaveSlots(storage).autosaved()).toMatchObject({
      value: { setupSeed: 7 }
    });
    expect(slots.loadAutosave(sim)).toMatchObject({
      value: { setup: { seed: 7 } }
    });
    // Saved over from a Classic game, the slot is Classic again.
    slots.saveOver(1, sim, null);
    expect(slots.list()).toMatchObject({ value: [{ setupSeed: null }] });
  });

  test('saves over a slot, keeping its name', () => {
    let time = 1;
    const slots = createSaveSlots(fakeStorage(), () => time);
    slots.save('Mine', createSim(7), null);
    time = 2;
    const sim = later(4);
    expect(slots.saveOver(1, sim, null)).toEqual({
      ok: true,
      value: {
        gameDate: formatClock(sim.clock),
        id: 1,
        loadable: true,
        movementRule: 'classic',
        name: 'Mine',
        savedAt: 2,
        setupSeed: null
      }
    });
    expect(slots.load(1, NO_WORLD)).toEqual({
      ok: true,
      value: { setup: null, state: sim }
    });
    expect(slots.list().ok && slots.list()).toMatchObject({
      value: [{ id: 1 }]
    });
  });

  test('renames and deletes slots', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    slots.save('a', createSim(7), null);
    slots.save('b', createSim(7), null);
    expect(slots.rename(2, 'Rivendell')).toMatchObject({
      ok: true,
      value: { name: 'Rivendell' }
    });
    expect(slots.rename(2, '   ')).toMatchObject({
      value: { name: 'Save 2' }
    });
    expect(slots.remove(1)).toEqual({ ok: true, value: undefined });
    expect(storage.items.has('wime.slot.1')).toBe(false);
    expect(slots.list()).toMatchObject({ value: [{ id: 2, name: 'Save 2' }] });
    // Ids are not reused after a delete.
    expect(slots.save('c', createSim(7), null)).toMatchObject({
      value: { id: 3 }
    });
  });

  test('reports a missing slot', () => {
    const slots = createSaveSlots(fakeStorage());
    expect(slots.load(9, NO_WORLD)).toEqual({ ok: false, reason: 'missing' });
    expect(slots.rename(9, 'x')).toEqual({ ok: false, reason: 'missing' });
    expect(slots.remove(9)).toEqual({ ok: false, reason: 'missing' });
    expect(slots.saveOver(9, createSim(7), null)).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  test('lists a save of another version but refuses to load it', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    slots.save('Old', createSim(7), null);
    const data = JSON.parse(storage.items.get('wime.slot.1')!) as {
      version: number;
    };
    storage.items.set(
      'wime.slot.1',
      JSON.stringify({ ...data, version: SAVE_VERSION - 2 })
    );
    const index = JSON.parse(storage.items.get(INDEX_KEY)!) as {
      slots: { version: number }[];
    };
    index.slots[0]!.version = SAVE_VERSION - 2;
    storage.items.set(INDEX_KEY, JSON.stringify(index));
    expect(slots.list()).toMatchObject({ value: [{ loadable: false }] });
    expect(slots.load(1, NO_WORLD)).toEqual({
      ok: false,
      reason: 'other-version'
    });
  });

  test('imports an old Archive save as a slot, once', () => {
    const storage = fakeStorage();
    const sim = later(3);
    createSaveSlots(storage).save('x', sim, null);
    const data = storage.items.get('wime.slot.1')!;
    const fresh = fakeStorage();
    fresh.items.set(LEGACY_ARCHIVE_KEY, data);
    const slots = createSaveSlots(fresh);
    const expected = {
      gameDate: formatClock(sim.clock),
      id: 1,
      loadable: true,
      movementRule: 'classic' as const,
      name: 'Archive',
      savedAt: null,
      setupSeed: null
    };
    expect(slots.list()).toEqual({ ok: true, value: [expected] });
    expect(fresh.items.has(LEGACY_ARCHIVE_KEY)).toBe(false);
    expect(slots.list()).toEqual({ ok: true, value: [expected] });
    expect(slots.load(1, NO_WORLD)).toEqual({
      ok: true,
      value: { setup: null, state: sim }
    });
  });

  test('lists an unreadable old Archive save as not loadable', () => {
    const storage = fakeStorage();
    storage.items.set(LEGACY_ARCHIVE_KEY, 'not json');
    const slots = createSaveSlots(storage);
    expect(slots.list()).toMatchObject({
      value: [{ gameDate: null, loadable: false, name: 'Archive' }]
    });
    expect(slots.load(1, NO_WORLD)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('reports full storage without throwing, and keeps the old slots', () => {
    const sim = createSim(7);
    // Room for two saves and their index, not three.
    const storage = fakeStorage(serialiseSave(sim).length * 2.7);
    const slots = createSaveSlots(storage);
    let result = slots.save('a', sim, null);
    expect(result.ok).toBe(true);
    for (let i = 0; i < 10 && result.ok; i++) {
      result = slots.save('more', sim, null);
    }
    expect(result).toEqual({ ok: false, reason: 'full' });
    const listed = slots.list();
    expect(listed.ok && listed.value.length).toBe(2);
    const ids = listed.ok ? listed.value.map(slot => slot.id) : [];
    for (const id of ids) {
      expect(slots.load(id, NO_WORLD).ok).toBe(true);
    }
  });

  test('reports unavailable storage without throwing', () => {
    const none = createSaveSlots(null);
    expect(none.list()).toEqual({ ok: false, reason: 'unavailable' });
    expect(none.save('a', createSim(7), null)).toEqual({
      ok: false,
      reason: 'unavailable'
    });
    const throwing = createSaveSlots({
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      removeItem: () => {},
      setItem: () => {}
    });
    expect(throwing.list()).toEqual({ ok: false, reason: 'unavailable' });
    expect(throwing.load(1, NO_WORLD)).toEqual({
      ok: false,
      reason: 'unavailable'
    });
  });

  test('keeps an autosave apart from the named slots', () => {
    let time = 1000;
    const storage = fakeStorage();
    const slots = createSaveSlots(storage, () => time);
    expect(slots.autosaved()).toEqual({ ok: true, value: null });
    expect(slots.loadAutosave(NO_WORLD)).toEqual({
      ok: false,
      reason: 'missing'
    });
    slots.save('Named', createSim(7), null);
    const first = later(4);
    slots.autosave(first, null);
    time = 2000;
    const second = later(8);
    expect(slots.autosave(second, null).ok).toBe(true);
    expect(slots.autosaved()).toEqual({
      ok: true,
      value: {
        gameDate: formatClock(second.clock),
        id: AUTOSAVE_ID,
        loadable: true,
        movementRule: 'classic',
        name: 'Autosave',
        savedAt: 2000,
        setupSeed: null
      }
    });
    expect(slots.list()).toMatchObject({ value: [{ id: 1, name: 'Named' }] });
    expect(slots.save('Next', first, null)).toMatchObject({ value: { id: 2 } });
    expect(createSaveSlots(storage).loadAutosave(NO_WORLD)).toEqual({
      ok: true,
      value: { setup: null, state: second }
    });
  });

  test('a game that has ended clears the autosave, keeping the named slots', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    slots.save('Named', createSim(7), null);
    slots.autosave(later(4), null);
    expect(slots.clearAutosave()).toEqual({ ok: true, value: undefined });
    expect(slots.autosaved()).toEqual({ ok: true, value: null });
    expect(createSaveSlots(storage).loadAutosave(NO_WORLD)).toEqual({
      ok: false,
      reason: 'missing'
    });
    expect(slots.list()).toMatchObject({ value: [{ id: 1, name: 'Named' }] });
    expect(slots.clearAutosave()).toEqual({ ok: true, value: undefined });
  });

  test('a failed autosave keeps the old one, without throwing', () => {
    const sim = createSim(7);
    const storage = fakeStorage(serialiseSave(sim).length * 2.7);
    const slots = createSaveSlots(storage);
    expect(slots.autosave(sim, null).ok).toBe(true);
    // A longer game no longer fits beside the old autosave.
    const longer = { ...later(4), routes: Array(500).fill([1, 2, 3]) };
    expect(slots.autosave(longer, null)).toEqual({ ok: false, reason: 'full' });
    expect(slots.loadAutosave(NO_WORLD)).toEqual({
      ok: true,
      value: { setup: null, state: sim }
    });
    expect(createSaveSlots(null).autosave(sim, null)).toEqual({
      ok: false,
      reason: 'unavailable'
    });
  });
});
