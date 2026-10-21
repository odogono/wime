import { textKey } from './assets';
import { messageDurationMs } from './message-timing';
import type { GameSpeed } from './tick-driver';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// Gandalf's letter (docs/spec/boot-sequence.md, "Gandalf's letter";
// finding:ui-gandalfs-letter): on the first Animation Level of a new
// game, BScene.res CSTR 56 in a box without buttons that closes by
// itself, while the Hobbits walk on beneath it. Shown once per game.

export const GANDALFS_LETTER_BOX = { height: 112, width: 256, x: 10, y: 5 };

// Pending until the Animation Level shows it, then open until its time
// is up.
export type GandalfsLetter =
  { kind: 'pending' } | { kind: 'open'; until: number };

export const stepGandalfsLetter = (
  letter: GandalfsLetter | null,
  now: number,
  onAnimationLevel: boolean,
  speed: GameSpeed
): GandalfsLetter | null => {
  if (!letter) {
    return null;
  }
  if (letter.kind === 'pending') {
    // Like any box without buttons it closes after 200 frames, or 60 at
    // the clock limit 0 (finding:ui-war-event-messages).
    return onAnimationLevel
      ? { kind: 'open', until: now + messageDurationMs(speed) }
      : letter;
  }
  return now < letter.until ? letter : null;
};

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
