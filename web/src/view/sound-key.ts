import type { BoxLevel } from './message-box';

/**
 * Whether a key pressed on a Level switches sound off or on. The
 * original checks Q, in either case, before any Level's own keys, so
 * the Level never changes the answer (finding:sound-q-toggles-sound).
 */
export const togglesSound = (key: string, _level: BoxLevel): boolean =>
  key.toLowerCase() === 'q';
