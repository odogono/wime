import { describe, expect, test } from 'bun:test';

import { togglesSound } from './sound-key';

describe('togglesSound', () => {
  // The original checks Q once, before any Level's keys, so it works
  // on every Level (finding:sound-q-toggles-sound).
  test.each(['campaign', 'animation', 'full-map'] as const)(
    'Q in either case toggles sound on the %s Level',
    level => {
      expect(togglesSound('q', level)).toBe(true);
      expect(togglesSound('Q', level)).toBe(true);
    }
  );

  test('other keys leave sound alone', () => {
    expect(togglesSound('u', 'animation')).toBe(false);
    expect(togglesSound('s', 'full-map')).toBe(false);
  });
});
