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
    slots.save('Before Bree', first);
    time = 2000;
    slots.save('  At Bree ', second);
    expect(slots.list()).toEqual({
      ok: true,
      value: [
        {
          gameDate: formatClock(first.clock),
          id: 1,
          loadable: true,
          name: 'Before Bree',
          savedAt: 1000
        },
        {
          gameDate: formatClock(second.clock),
          id: 2,
          loadable: true,
          name: 'At Bree',
          savedAt: 2000
        }
      ]
    });
  });

  test('loads a slot back to the state it saved', () => {
    const slots = createSaveSlots(fakeStorage());
    const sim = later(5);
    const saved = slots.save('One', sim);
    const loaded = saved.ok && slots.load(saved.value.id, sim.tilemap);
    expect(loaded).toEqual({ ok: true, value: sim });
  });

  test('saves over a slot, keeping its name', () => {
    let time = 1;
    const slots = createSaveSlots(fakeStorage(), () => time);
    slots.save('Mine', createSim(7));
    time = 2;
    const sim = later(4);
    expect(slots.saveOver(1, sim)).toEqual({
      ok: true,
      value: {
        gameDate: formatClock(sim.clock),
        id: 1,
        loadable: true,
        name: 'Mine',
        savedAt: 2
      }
    });
    expect(slots.load(1, null)).toEqual({ ok: true, value: sim });
    expect(slots.list().ok && slots.list()).toMatchObject({
      value: [{ id: 1 }]
    });
  });

  test('renames and deletes slots', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    slots.save('a', createSim(7));
    slots.save('b', createSim(7));
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
    expect(slots.save('c', createSim(7))).toMatchObject({ value: { id: 3 } });
  });

  test('reports a missing slot', () => {
    const slots = createSaveSlots(fakeStorage());
    expect(slots.load(9, null)).toEqual({ ok: false, reason: 'missing' });
    expect(slots.rename(9, 'x')).toEqual({ ok: false, reason: 'missing' });
    expect(slots.remove(9)).toEqual({ ok: false, reason: 'missing' });
    expect(slots.saveOver(9, createSim(7))).toEqual({
      ok: false,
      reason: 'missing'
    });
  });

  test('lists a save of another version but refuses to load it', () => {
    const storage = fakeStorage();
    const slots = createSaveSlots(storage);
    slots.save('Old', createSim(7));
    const data = JSON.parse(storage.items.get('wime.slot.1')!) as {
      version: number;
    };
    storage.items.set(
      'wime.slot.1',
      JSON.stringify({ ...data, version: SAVE_VERSION - 1 })
    );
    const index = JSON.parse(storage.items.get(INDEX_KEY)!) as {
      slots: { version: number }[];
    };
    index.slots[0]!.version = SAVE_VERSION - 1;
    storage.items.set(INDEX_KEY, JSON.stringify(index));
    expect(slots.list()).toMatchObject({ value: [{ loadable: false }] });
    expect(slots.load(1, null)).toEqual({
      ok: false,
      reason: 'other-version'
    });
  });

  test('imports an old Archive save as a slot, once', () => {
    const storage = fakeStorage();
    const sim = later(3);
    createSaveSlots(storage).save('x', sim);
    const data = storage.items.get('wime.slot.1')!;
    const fresh = fakeStorage();
    fresh.items.set(LEGACY_ARCHIVE_KEY, data);
    const slots = createSaveSlots(fresh);
    const expected = {
      gameDate: formatClock(sim.clock),
      id: 1,
      loadable: true,
      name: 'Archive',
      savedAt: null
    };
    expect(slots.list()).toEqual({ ok: true, value: [expected] });
    expect(fresh.items.has(LEGACY_ARCHIVE_KEY)).toBe(false);
    expect(slots.list()).toEqual({ ok: true, value: [expected] });
    expect(slots.load(1, null)).toEqual({ ok: true, value: sim });
  });

  test('lists an unreadable old Archive save as not loadable', () => {
    const storage = fakeStorage();
    storage.items.set(LEGACY_ARCHIVE_KEY, 'not json');
    const slots = createSaveSlots(storage);
    expect(slots.list()).toMatchObject({
      value: [{ gameDate: null, loadable: false, name: 'Archive' }]
    });
    expect(slots.load(1, null)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('reports full storage without throwing, and keeps the old slots', () => {
    const sim = createSim(7);
    // Room for two saves and their index, not three.
    const storage = fakeStorage(serialiseSave(sim).length * 2.5);
    const slots = createSaveSlots(storage);
    let result = slots.save('a', sim);
    expect(result.ok).toBe(true);
    for (let i = 0; i < 10 && result.ok; i++) {
      result = slots.save('more', sim);
    }
    expect(result).toEqual({ ok: false, reason: 'full' });
    const listed = slots.list();
    expect(listed.ok && listed.value.length).toBe(2);
    const ids = listed.ok ? listed.value.map(slot => slot.id) : [];
    for (const id of ids) {
      expect(slots.load(id, null).ok).toBe(true);
    }
  });

  test('reports unavailable storage without throwing', () => {
    const none = createSaveSlots(null);
    expect(none.list()).toEqual({ ok: false, reason: 'unavailable' });
    expect(none.save('a', createSim(7))).toEqual({
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
    expect(throwing.load(1, null)).toEqual({
      ok: false,
      reason: 'unavailable'
    });
  });

  test('keeps an autosave apart from the named slots', () => {
    let time = 1000;
    const storage = fakeStorage();
    const slots = createSaveSlots(storage, () => time);
    expect(slots.autosaved()).toEqual({ ok: true, value: null });
    expect(slots.loadAutosave(null)).toEqual({ ok: false, reason: 'missing' });
    slots.save('Named', createSim(7));
    const first = later(4);
    slots.autosave(first);
    time = 2000;
    const second = later(8);
    expect(slots.autosave(second).ok).toBe(true);
    expect(slots.autosaved()).toEqual({
      ok: true,
      value: {
        gameDate: formatClock(second.clock),
        id: AUTOSAVE_ID,
        loadable: true,
        name: 'Autosave',
        savedAt: 2000
      }
    });
    expect(slots.list()).toMatchObject({ value: [{ id: 1, name: 'Named' }] });
    expect(slots.save('Next', first)).toMatchObject({ value: { id: 2 } });
    expect(createSaveSlots(storage).loadAutosave(null)).toEqual({
      ok: true,
      value: second
    });
  });

  test('a failed autosave keeps the old one, without throwing', () => {
    const sim = createSim(7);
    const storage = fakeStorage(serialiseSave(sim).length * 1.5);
    const slots = createSaveSlots(storage);
    expect(slots.autosave(sim).ok).toBe(true);
    // A longer game no longer fits beside the old autosave.
    const longer = { ...later(4), routes: Array(500).fill([1, 2, 3]) };
    expect(slots.autosave(longer)).toEqual({ ok: false, reason: 'full' });
    expect(slots.loadAutosave(null)).toEqual({ ok: true, value: sim });
    expect(createSaveSlots(null).autosave(sim)).toEqual({
      ok: false,
      reason: 'unavailable'
    });
  });
});
