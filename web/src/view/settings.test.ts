import { describe, expect, test } from 'bun:test';

import { NO_DEBUG_VIEWS } from './debug-views';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings
} from './settings';

const memory = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => void items.delete(key),
    setItem: (key: string, value: string) => void items.set(key, value)
  };
};

describe('settings', () => {
  test('start with sound on, the full window, the glass as in the original and the Atlas map', () => {
    expect(loadSettings(memory())).toEqual({
      debug: NO_DEBUG_VIEWS,
      glassShowsEvil: false,
      map: 'atlas',
      size: 1,
      sound: true
    });
  });

  test('are kept between visits', () => {
    const storage = memory();
    saveSettings(
      {
        debug: NO_DEBUG_VIEWS,
        glassShowsEvil: true,
        map: 'classic',
        size: 0.5,
        sound: false
      },
      storage
    );
    expect(loadSettings(storage)).toEqual({
      debug: NO_DEBUG_VIEWS,
      glassShowsEvil: true,
      map: 'classic',
      size: 0.5,
      sound: false
    });
  });

  test('keep the map chosen, and the Atlas map otherwise', () => {
    expect(
      loadSettings(memory({ [SETTINGS_KEY]: '{"map":"classic"}' })).map
    ).toBe('classic');
    expect(
      loadSettings(memory({ [SETTINGS_KEY]: '{"map":"sepia"}' })).map
    ).toBe('atlas');
  });

  test('keep the Debug views, and drop what is not one', () => {
    const storage = memory({
      [SETTINGS_KEY]: '{"debug":{"paths":true,"cheat":true,"labels":1}}'
    });
    expect(loadSettings(storage).debug).toEqual({
      ...NO_DEBUG_VIEWS,
      paths: true
    });
  });

  test('fall back to the defaults for what cannot be read', () => {
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{' }))).toEqual(
      DEFAULT_SETTINGS
    );
    expect(
      loadSettings(
        memory({
          [SETTINGS_KEY]: '{"glassShowsEvil":1,"size":0.6,"sound":false}'
        })
      )
    ).toEqual({
      debug: NO_DEBUG_VIEWS,
      glassShowsEvil: false,
      map: 'atlas',
      size: 1,
      sound: false
    });
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
