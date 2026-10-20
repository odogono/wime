import { FRAME_MS, type GameSpeed } from './tick-driver';

// Generic message boxes with no buttons (docs/spec/time.md): 60 frames
// on Very Hasty, 200 otherwise, at the original's 50 Hz.
export const messageDurationMs = (speed: GameSpeed): number =>
  (speed === 'very-hasty' ? 60 : 200) * FRAME_MS;
