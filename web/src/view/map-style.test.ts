import { describe, expect, test } from 'bun:test';

import { loadMapStyle, saveMapStyle } from './map-style';

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value)
  };
};

describe('the Map setting', () => {
  test('is Classic until Atlas is chosen, and is remembered', () => {
    const storage = memory();
    expect(loadMapStyle(storage)).toBe('classic');
    expect(saveMapStyle(storage, 'atlas')).toBe(true);
    expect(loadMapStyle(storage)).toBe('atlas');
  });

  test('is Classic where storage cannot be read', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      }
    };
    expect(loadMapStyle(broken)).toBe('classic');
    expect(saveMapStyle(broken, 'atlas')).toBe(false);
    expect(loadMapStyle(null)).toBe('classic');
  });
});
