import {
  MEETING_TIMEOUT_FRAMES,
  answerMeeting,
  type Meeting,
  type MeetingAnswer,
  type RosterEntry,
  type SimState
} from '../sim/index';
import { measureText, type FontMetrics } from './font';
import { messageDurationMs } from './message-timing';
import { FRAME_MS, type GameSpeed } from './tick-driver';
import {
  drawWindowFrame,
  windowText,
  type Box,
  type WindowStyle
} from './window-frame';

// The meeting window on the Campaign Level (docs/spec/forces.md,
// "The meeting window"; finding:ui-meeting-window). The sim stops while
// state.meeting is set; this module words the window, answers it on a
// press or, after 720 frames, with its default, "Continue on". A pure
// state machine over real time in milliseconds, like the combat
// windows. Positions are the original's, in lo-res pixels, and the
// frame and lettering are the original's (finding:ui-window-frame-tiles,
// finding:ui-text-font-lord-10).

export const MEETING_WINDOW_MS = MEETING_TIMEOUT_FRAMES * FRAME_MS;
export const GOLLUM_SNEAKS_AWAY = 'GOLLUM quietly sneaks away.';

export interface MeetingButton extends Box {
  choice: MeetingAnswer;
  label: string;
}

// The box's arguments: 20 more height with a second line. Its lines sit
// at 8 and 18 and its buttons at 30, within the box.
const BOX_X = 88;
const BOX_Y = 5;
const BOX_WIDTH = 192;
const BOX_HEIGHT = 24;
const LINE_HEIGHT = 20;
const TEXT_X = 10;
const LINE_YS = [8, 18];
const LEFT_BUTTON_X = 16;
const RIGHT_BUTTON_X = 110;
const BUTTON_Y = 30;

export type MeetingUi =
  | {
      box: Box;
      buttons: MeetingButton[];
      deadline: number;
      kind: 'window';
      lines: string[];
    }
  | { kind: 'notice'; text: string; until: number };

const capitalise = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

// A Unit is named with its head count and takes the plural verb.
export const named = (entry: RosterEntry): string =>
  entry.isUnit ? `${entry.strength} ${entry.name}` : entry.name;

// The window's lines: "<A> meets <B>.", then what B offers. A plain
// meeting has one line (finding:ui-meeting-window).
export const meetingLines = (sim: SimState, meeting: Meeting): string[] => {
  const a = sim.roster[meeting.a]!;
  const b = sim.roster[meeting.b]!;
  const first = `${named(a)} meet${a.isUnit ? '' : 's'} ${named(b)}.`;
  // In the second line B, a Unit, is capitalised, and A, a Unit, gets
  // "the".
  const host = b.isUnit ? capitalise(b.name) : b.name;
  const guest = a.isUnit ? `the ${a.name}` : a.name;
  switch (meeting.kind) {
    case 'follow':
      return [first, `${host} welcome${b.isUnit ? '' : 's'} ${guest} to join.`];
    case 'talk':
      return [first, `${host} invites ${guest} to pause and talk.`];
    case 'plain':
      return [first];
  }
};

// A button is the area from (x, y - 1), 4 wider than its label and as
// deep as the font (finding:ui-message-box-text-colour).
const button = (
  font: FontMetrics,
  box: Box,
  x: number,
  choice: MeetingAnswer,
  label: string
): MeetingButton => ({
  choice,
  height: font.height,
  label,
  width: measureText(font, label) + 4,
  x: box.x + x,
  y: box.y + BUTTON_Y - 1
});

export const openMeetingUi = (
  font: FontMetrics,
  sim: SimState,
  now: number
): MeetingUi | null => {
  const meeting = sim.meeting;
  if (!meeting) {
    return null;
  }
  const lines = meetingLines(sim, meeting);
  // provisional: the one-line box's height, 24, would leave its buttons
  // outside it, so it is drawn as tall as the two-line box.
  const box = {
    height: BOX_HEIGHT + LINE_HEIGHT,
    width: BOX_WIDTH,
    x: BOX_X,
    y: BOX_Y
  };
  const left =
    meeting.kind === 'follow'
      ? button(
          font,
          box,
          LEFT_BUTTON_X,
          'follow',
          `Follow ${sim.roster[meeting.b]!.name}`
        )
      : button(font, box, LEFT_BUTTON_X, 'go-there', 'Go there');
  return {
    box,
    buttons: [
      left,
      button(font, box, RIGHT_BUTTON_X, 'continue-on', 'Continue on')
    ],
    deadline: now + MEETING_WINDOW_MS,
    kind: 'window',
    lines
  };
};

// Answer the meeting. The caller handles the Level change for "Go
// there". Gollum sneaking away leaves a notice.
const answer = (
  sim: SimState,
  choice: MeetingAnswer,
  now: number,
  speed: GameSpeed
): { sim: SimState; ui: MeetingUi | null } => {
  const result = answerMeeting(sim, choice);
  return {
    sim: result.world,
    ui: result.gollumSneaksAway
      ? {
          kind: 'notice',
          text: GOLLUM_SNEAKS_AWAY,
          until: now + messageDurationMs(speed)
        }
      : null
  };
};

// Advance to `now`: an unanswered window answers its default, "Continue
// on", at its deadline, and a notice closes when its time is up.
export const stepMeetingUi = (
  ui: MeetingUi,
  sim: SimState,
  now: number,
  speed: GameSpeed = 'normal'
): { sim: SimState; ui: MeetingUi | null } => {
  if (ui.kind === 'notice') {
    return { sim, ui: now < ui.until ? ui : null };
  }
  return now >= ui.deadline
    ? answer(sim, 'continue-on', now, speed)
    : { sim, ui };
};

const inBox = (box: Box, point: { x: number; y: number }): boolean =>
  point.x >= box.x &&
  point.x < box.x + box.width &&
  point.y >= box.y &&
  point.y < box.y + box.height;

// A press while the window is up: a button answers it, anywhere else
// does nothing. `choice` is the button pressed, if any.
export const pressMeetingUi = (
  ui: MeetingUi,
  sim: SimState,
  point: { x: number; y: number },
  now: number,
  speed: GameSpeed = 'normal'
): { choice: MeetingAnswer | null; sim: SimState; ui: MeetingUi | null } => {
  if (ui.kind === 'notice') {
    return { choice: null, sim, ui };
  }
  const pressed = ui.buttons.find(candidate => inBox(candidate, point));
  if (!pressed) {
    return { choice: null, sim, ui };
  }
  return { choice: pressed.choice, ...answer(sim, pressed.choice, now, speed) };
};

// Whether the window holds the game: the clock stops for a box with
// buttons, not for a notice (finding:ui-war-event-messages).
export const meetingHoldsTime = (ui: MeetingUi | null): boolean =>
  ui?.kind === 'window';

export const drawMeetingUi = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  ui: MeetingUi
): void => {
  if (ui.kind === 'notice') {
    const box = drawWindowFrame(ctx, style, {
      height: 24,
      width: measureText(style.font.metrics, ui.text) + 2 * TEXT_X,
      x: 10,
      y: 5
    });
    windowText(ctx, style, ui.text, box.x + TEXT_X, box.y + 8);
    return;
  }
  drawWindowFrame(ctx, style, ui.box);
  ui.lines.forEach((line, i) =>
    windowText(ctx, style, line, ui.box.x + TEXT_X, ui.box.y + LINE_YS[i]!)
  );
  // The label at (x + 2, y) inside a frame from (x - 1, y - 2), 6 wider
  // and 2 deeper than the label (finding:ui-message-box-text-colour).
  ctx.strokeStyle = style.colours.text;
  ctx.lineWidth = 1;
  for (const candidate of ui.buttons) {
    const x = candidate.x;
    const y = candidate.y + 1;
    ctx.strokeRect(
      x - 1 + 0.5,
      y - 2 + 0.5,
      candidate.width + 2 - 1,
      candidate.height + 2 - 1
    );
    windowText(ctx, style, candidate.label, x + 2, y);
  }
};
