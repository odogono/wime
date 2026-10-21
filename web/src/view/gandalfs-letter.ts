import { textKey } from './assets';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// Gandalf's letter (docs/spec/boot-sequence.md, "Gandalf's letter";
// finding:ui-gandalfs-letter): on the first Animation Level of a new
// game, BScene.res CSTR 56 in a box without buttons, while the Hobbits
// walk on beneath it. Shown once per game. It is raised like any other
// box, and closes as one without buttons does on the Animation Level,
// 1,500 frames after it opens unless a later box replaces it
// (message-box.ts).

export const GANDALFS_LETTER_BOX = { height: 112, width: 256, x: 10, y: 5 };

// Pending until the Animation Level raises it, then open.
export type GandalfsLetter = { kind: 'open' } | { kind: 'pending' };

export const drawGandalfsLetter = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  texts: Map<string, string>
): void => {
  const box = drawWindowFrame(ctx, style, GANDALFS_LETTER_BOX);
  // The message box letters its text 10 pixels in and 8 down
  // (finding:ui-window-frame-tiles).
  windowText(
    ctx,
    style,
    texts.get(textKey('BScene.res', 56)) ?? '',
    box.x + 10,
    box.y + 8
  );
};
