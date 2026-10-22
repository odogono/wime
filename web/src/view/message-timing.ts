import { FRAME_MS, type GameSpeed } from './tick-driver';

// Generic message boxes with no buttons (docs/spec/time.md): 60 frames
// on Very Hasty, 200 otherwise, at the original's 50 Hz.
export const messageDurationMs = (speed: GameSpeed): number =>
  (speed === 'very-hasty' ? 60 : 200) * FRAME_MS;

// A box with buttons is answered by its default 720 frames after it
// opens, or 1,020 on the Animation Level; a box without buttons may be
// replaced after 200 frames, or 60 on Very Hasty
// (finding:ui-message-box-timeouts-by-level).
export const BUTTONS_DEADLINE_FRAMES = { animation: 1020, campaign: 720 };

// How long past its deadline each Level's loop keeps a box without
// buttons: 1,020 frames on the Campaign Level, 1,300 on the Animation
// Level, so 1,220 and 1,500 in all, or 1,080 and 1,360 on Very Hasty. On
// the Full Map Level no box times out
// (finding:ui-message-box-timeouts-by-level).
export const LINGER_FRAMES = { animation: 1300, campaign: 1020 };
