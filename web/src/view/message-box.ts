import { messageDurationMs } from './message-timing';
import { FRAME_MS, type GameSpeed } from './tick-driver';

// The one message box (finding:ui-message-box-opening-waits-for-the-open-box):
// only one box is ever open. A box raised while another is up waits
// until the open box's deadline has passed, the whole game standing still
// meanwhile, and then replaces it, its default pressed. Boxes are shown
// in the order they are raised, with no priority between kinds. A pure
// state machine over the view's real time in milliseconds: main.ts keeps
// what each box shows and presses its default when this says to close it.

export type BoxLevel = 'animation' | 'campaign' | 'full-map';

export interface MessageBox<K> {
  buttons: boolean;
  // Real time after which a later box may replace this one; for a box
  // with buttons, also when its default is pressed.
  deadline: number;
  kind: K;
  // What the box shows, so a change of it can be told from the same box.
  ref: object;
}

// A box with buttons is answered by its default 720 frames after it
// opens, or 1,020 on the Animation Level; a box without buttons may be
// replaced after 200 frames, or 60 on Very Hasty
// (finding:ui-message-box-timeouts-by-level).
export const BUTTONS_DEADLINE_FRAMES = { animation: 1020, campaign: 720 };

export const openBox = <K>(
  kind: K,
  ref: object,
  buttons: boolean,
  now: number,
  level: BoxLevel,
  speed: GameSpeed
): MessageBox<K> => ({
  buttons,
  deadline:
    now +
    (buttons
      ? BUTTONS_DEADLINE_FRAMES[
          level === 'animation' ? 'animation' : 'campaign'
        ] * FRAME_MS
      : messageDurationMs(speed)),
  kind,
  ref
});

// Whether a box raised now may open, replacing the open one.
export const mayReplace = <K>(
  box: MessageBox<K> | null,
  now: number
): boolean => box === null || now >= box.deadline;

// How long past its deadline each Level's loop keeps a box without
// buttons: 1,020 frames on the Campaign Level, 1,300 on the Animation
// Level, so 1,220 and 1,500 in all, or 1,080 and 1,360 on Very Hasty. On
// the Full Map Level no box times out
// (finding:ui-message-box-timeouts-by-level).
export const LINGER_FRAMES = { animation: 1300, campaign: 1020 };

// Whether the Level's loop closes the box now, pressing its default.
export const timedOut = <K>(
  box: MessageBox<K>,
  now: number,
  level: BoxLevel
): boolean =>
  level !== 'full-map' &&
  now >= box.deadline + (box.buttons ? 0 : LINGER_FRAMES[level] * FRAME_MS);

export interface BoxStep {
  // Close the open box, pressing its default.
  close: boolean;
  // Open the raised box.
  open: boolean;
  // The raised box waits, and the game with it.
  waiting: boolean;
}

// One step of the box at `now` on `level`, with or without a box raised
// and waiting to open.
export const stepBox = <K>(
  box: MessageBox<K> | null,
  now: number,
  level: BoxLevel,
  raised: boolean
): BoxStep => {
  if (raised) {
    return mayReplace(box, now)
      ? { close: box !== null, open: true, waiting: false }
      : { close: false, open: false, waiting: true };
  }
  return {
    close: box !== null && timedOut(box, now, level),
    open: false,
    waiting: false
  };
};
