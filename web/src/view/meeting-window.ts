import {
  MEETING_TIMEOUT_FRAMES,
  answerMeeting,
  type Meeting,
  type MeetingAnswer,
  type RosterEntry,
  type SimState
} from '../sim/index';
import { drawWindowFrame, type Box, type WindowStyle } from './window-frame';

// The meeting window on the Campaign Level (docs/spec/forces.md,
// "The meeting window"; finding:ui-meeting-window). The sim stops while
// state.meeting is set; this module words the window, answers it on a
// press or, after 720 frames, with its default, "Continue on". A pure
// state machine over real time in milliseconds, like the combat
// windows. Positions are the original's, in lo-res pixels, and the
// frame is the original's (finding:ui-window-frame-tiles); the
// lettering is provisional.

const FRAME_MS = 20;
export const MEETING_WINDOW_MS = MEETING_TIMEOUT_FRAMES * FRAME_MS;
// "GOLLUM quietly sneaks away." is a box with no buttons, up as long as
// the War Event announcements (finding:ui-war-event-messages).
export const NOTICE_MS = 200 * FRAME_MS;
export const GOLLUM_SNEAKS_AWAY = 'GOLLUM quietly sneaks away.';

// "Go there" opens the Animation Level, which is not built yet.
export type MeetingChoice = MeetingAnswer | 'go-there';

export interface MeetingButton extends Box {
  choice: MeetingChoice;
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
const BUTTON_HEIGHT = 10;
const CHAR_WIDTH = 6;

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
const named = (entry: RosterEntry): string =>
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

const button = (
  box: Box,
  x: number,
  choice: MeetingChoice,
  label: string
): MeetingButton => ({
  choice,
  height: BUTTON_HEIGHT,
  label,
  width: label.length * CHAR_WIDTH,
  x: box.x + x,
  y: box.y + BUTTON_Y
});

export const openMeetingUi = (sim: SimState, now: number): MeetingUi | null => {
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
          box,
          LEFT_BUTTON_X,
          'follow',
          `Follow ${sim.roster[meeting.b]!.name}`
        )
      : button(box, LEFT_BUTTON_X, 'go-there', 'Go there');
  return {
    box,
    buttons: [left, button(box, RIGHT_BUTTON_X, 'continue-on', 'Continue on')],
    deadline: now + MEETING_WINDOW_MS,
    kind: 'window',
    lines
  };
};

// Answer the meeting. "Go there" answers as "Continue on" until the
// Animation Level is built. Gollum sneaking away leaves a notice.
const answer = (
  sim: SimState,
  choice: MeetingChoice,
  now: number
): { sim: SimState; ui: MeetingUi | null } => {
  const result = answerMeeting(
    sim,
    choice === 'follow' ? 'follow' : 'continue-on'
  );
  return {
    sim: result.world,
    ui: result.gollumSneaksAway
      ? { kind: 'notice', text: GOLLUM_SNEAKS_AWAY, until: now + NOTICE_MS }
      : null
  };
};

// Advance to `now`: an unanswered window answers its default, "Continue
// on", at its deadline, and a notice closes when its time is up.
export const stepMeetingUi = (
  ui: MeetingUi,
  sim: SimState,
  now: number
): { sim: SimState; ui: MeetingUi | null } => {
  if (ui.kind === 'notice') {
    return { sim, ui: now < ui.until ? ui : null };
  }
  return now >= ui.deadline ? answer(sim, 'continue-on', now) : { sim, ui };
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
  now: number
): { choice: MeetingChoice | null; sim: SimState; ui: MeetingUi | null } => {
  if (ui.kind === 'notice') {
    return { choice: null, sim, ui };
  }
  const pressed = ui.buttons.find(candidate => inBox(candidate, point));
  if (!pressed) {
    return { choice: null, sim, ui };
  }
  return { choice: pressed.choice, ...answer(sim, pressed.choice, now) };
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
      width: ui.text.length * CHAR_WIDTH + 20,
      x: 10,
      y: 5
    });
    ctx.fillText(ui.text, box.x + TEXT_X, box.y + 8, box.width - 2 * TEXT_X);
    return;
  }
  drawWindowFrame(ctx, style, ui.box);
  ui.lines.forEach((line, i) =>
    ctx.fillText(
      line,
      ui.box.x + TEXT_X,
      ui.box.y + LINE_YS[i]!,
      ui.box.width - 2 * TEXT_X
    )
  );
  ctx.strokeStyle = style.colours.text;
  ctx.lineWidth = 1;
  for (const candidate of ui.buttons) {
    ctx.strokeRect(
      candidate.x + 0.5,
      candidate.y + 0.5,
      candidate.width - 1,
      candidate.height - 1
    );
    ctx.fillText(
      candidate.label,
      candidate.x + 3,
      candidate.y + 1,
      candidate.width - 6
    );
  }
};
