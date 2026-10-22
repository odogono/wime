import type { SimState } from '../sim/index';
import type { StatusBox } from './animation-status';
import {
  combatHoldsTime,
  startCombatUi,
  stepCombatUi,
  type Choose,
  type CombatUi
} from './combat-window';
import type { FontMetrics } from './font';
import type { InfoWindow } from './force-window';
import type { GandalfsLetter } from './gandalfs-letter';
import {
  meetingHoldsTime,
  openMeetingUi,
  stepMeetingUi,
  type MeetingUi
} from './meeting-window';
import {
  BUTTONS_DEADLINE_FRAMES,
  LINGER_FRAMES,
  messageDurationMs
} from './message-timing';
import { takePassingMessage, type PassingMessage } from './passing-message';
import { holdsClock, type ProvisionsWindow } from './provisions-window';
import { FRAME_MS, type GameSpeed } from './tick-driver';
import { takeWarEventMessage, type WarEventMessage } from './war-event-message';

// The one message box (finding:ui-message-box-opening-waits-for-the-open-box):
// only one box is ever open. A box raised while another is up waits
// until the open box's deadline has passed, the whole game standing still
// meanwhile, and then replaces it, its default pressed. Boxes are shown
// in the order they are raised, with no priority between kinds. A pure
// state machine over the view's real time in milliseconds, under
// `Messages`, which owns what each kind of box shows and carries out
// the selection, replacement and default answers the timing calls for.

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

// What the one message box shows: the fight's announcement or an
// ignored fight's boxes, a Force's or a Place's window, Gandalf's
// letter, the meeting window or its notice, a pass-by, the provisions
// sack's windows, a status line or a War Event.
export type MessageKind =
  | 'fight'
  | 'info'
  | 'letter'
  | 'meeting'
  | 'passing'
  | 'provisions'
  | 'status'
  | 'war';

// The message box and what each kind shows. A combat window is held in
// `combat` but is not a message box. `landed` is Put Down's message,
// raised once the object is down.
export interface Messages {
  box: MessageBox<MessageKind> | null;
  combat: CombatUi | null;
  info: InfoWindow | null;
  landed: ProvisionsWindow | null;
  letter: GandalfsLetter | null;
  meeting: MeetingUi | null;
  passing: PassingMessage | null;
  provisions: ProvisionsWindow | null;
  status: StatusBox | null;
  // A raised box waits for the open box's deadline, holding the game.
  waiting: boolean;
  war: WarEventMessage | null;
}

export const NO_MESSAGES: Messages = {
  box: null,
  combat: null,
  info: null,
  landed: null,
  letter: null,
  meeting: null,
  passing: null,
  provisions: null,
  status: null,
  waiting: false,
  war: null
};

export interface MessageWorld {
  messages: Messages;
  sim: SimState;
}

export interface MessageContext {
  // Picks the combat messages' wordings.
  choose: Choose;
  // The window font, which lays out the meeting window.
  font: FontMetrics;
  level: BoxLevel;
  now: number;
  speed: GameSpeed;
}

// What a box of each kind shows, if anything.
const contentOf = (messages: Messages, kind: MessageKind): object | null => {
  switch (kind) {
    case 'fight':
      return messages.combat?.kind === 'window' ? null : messages.combat;
    case 'info':
      return messages.info;
    case 'letter':
      return messages.letter?.kind === 'open' ? messages.letter : null;
    case 'meeting':
      return messages.meeting;
    case 'passing':
      return messages.passing;
    case 'provisions':
      return messages.provisions;
    case 'status':
      return messages.status;
    case 'war':
      return messages.war;
  }
};

const hasButtons = (messages: Messages, kind: MessageKind): boolean =>
  (kind === 'fight' && messages.combat?.kind === 'announcement') ||
  (kind === 'meeting' && meetingHoldsTime(messages.meeting)) ||
  (kind === 'provisions' && holdsClock(messages.provisions));

// Open the box for what a kind now shows, at once, as a click on a
// figure, the eye or the sack does.
export const showMessage = (
  messages: Messages,
  kind: MessageKind,
  { level, now, speed }: MessageContext
): Messages => {
  const ref = contentOf(messages, kind);
  return {
    ...messages,
    box: ref
      ? openBox(kind, ref, hasButtons(messages, kind), now, level, speed)
      : null
  };
};

// Follow the open box once it is answered, or turned into the next box
// of its kind: a list chosen from, a meeting's notice, a fight's boxes.
export const syncMessage = (
  messages: Messages,
  context: MessageContext
): Messages =>
  messages.box && contentOf(messages, messages.box.kind) !== messages.box.ref
    ? showMessage(messages, messages.box.kind, context)
    : messages;

// Close the open box, pressing its default if it has buttons, as a
// timeout, a later box, a click on a Force or a Place and leaving a
// Level do (finding:ui-message-box-opening-waits-for-the-open-box,
// finding:ui-message-box-closed-on-leaving-a-level). Pressing "Ignore it"
// leaves the fight's own boxes open.
export const closeMessage = (
  world: MessageWorld,
  context: MessageContext
): MessageWorld => {
  const messages = syncMessage(world.messages, context);
  if (!messages.box) {
    return { messages, sim: world.sim };
  }
  const kind = messages.box.kind;
  const closed = { ...messages, box: null };
  switch (kind) {
    case 'fight': {
      const combat = closed.combat;
      if (combat?.kind !== 'announcement') {
        return { messages: { ...closed, combat: null }, sim: world.sim };
      }
      const { sim, ui } = stepCombatUi(
        combat,
        world.sim,
        combat.deadline,
        context.choose,
        context.speed
      );
      return {
        messages: showMessage({ ...closed, combat: ui }, 'fight', context),
        sim
      };
    }
    case 'meeting': {
      // "Continue on"; a notice it leaves is dropped with the box.
      const meeting = closed.meeting;
      const sim =
        meeting?.kind === 'window'
          ? stepMeetingUi(meeting, world.sim, meeting.deadline).sim
          : world.sim;
      return { messages: { ...closed, meeting: null }, sim };
    }
    case 'info':
      return { messages: { ...closed, info: null }, sim: world.sim };
    case 'letter':
      return { messages: { ...closed, letter: null }, sim: world.sim };
    case 'passing':
      return { messages: { ...closed, passing: null }, sim: world.sim };
    case 'provisions':
      return { messages: { ...closed, provisions: null }, sim: world.sim };
    case 'status':
      return { messages: { ...closed, status: null }, sim: world.sim };
    case 'war':
      return { messages: { ...closed, war: null }, sim: world.sim };
  }
};

// The next box the game has raised and not yet shown. Within a tick,
// pass-bys are raised during the roster sweep, before the meeting or
// fight that stops it, and War Events at its end (sim/state.ts). The
// Campaign Level opens meetings and fights; the Animation Level shows
// Gandalf's letter and Put Down's message. `held` is the view's own
// hold: an Encounter's talk, the ending or the Council's window.
const raisedKind = (
  { messages, sim }: MessageWorld,
  level: BoxLevel,
  held: boolean
): MessageKind | null => {
  if (
    level === 'full-map' ||
    held ||
    sim.ending ||
    sim.council ||
    combatHoldsTime(messages.combat)
  ) {
    return null;
  }
  if (level === 'animation' && messages.letter?.kind === 'pending') {
    return 'letter';
  }
  if (level === 'animation' && messages.landed) {
    return 'provisions';
  }
  if (sim.passings.length > 0) {
    return 'passing';
  }
  if (level === 'campaign' && sim.meeting && !messages.meeting) {
    return 'meeting';
  }
  if (level === 'campaign' && sim.fight && !messages.combat) {
    return 'fight';
  }
  return sim.announcements.length > 0 ? 'war' : null;
};

// Take what a raised box shows from the game and open it.
const raise = (
  { messages, sim }: MessageWorld,
  kind: MessageKind,
  context: MessageContext
): MessageWorld => {
  let next = messages;
  let world = sim;
  switch (kind) {
    case 'letter':
      next = { ...next, letter: { kind: 'open' } };
      break;
    case 'provisions':
      next = { ...next, landed: null, provisions: next.landed };
      break;
    case 'passing': {
      const taken = takePassingMessage(world);
      next = { ...next, passing: taken.message };
      world = taken.sim;
      break;
    }
    case 'war': {
      const taken = takeWarEventMessage(world);
      next = { ...next, war: taken.message };
      world = taken.sim;
      break;
    }
    case 'meeting':
      next = {
        ...next,
        meeting: openMeetingUi(context.font, world, context.now)
      };
      break;
    case 'fight':
      next = { ...next, combat: startCombatUi(world, context.now) };
      break;
    default:
      break;
  }
  return { messages: showMessage(next, kind, context), sim: world };
};

export interface MessageStep extends MessageWorld {
  // A meeting's or a fight's decision window opened, which drops any
  // half-given Order or open window (finding:ui-pointer-and-icon-column).
  decision: boolean;
  // A wait ended: figures it held take up their scripts from now.
  resumed: boolean;
}

// Time the open box out and open the boxes raised, one at a time, in
// order. A box raised before the open box's deadline waits, and
// `waiting` holds the game until it opens.
export const stepMessages = (
  world: MessageWorld,
  context: MessageContext,
  held = false
): MessageStep => {
  const wasWaiting = world.messages.waiting;
  let decision = false;
  let current: MessageWorld = {
    messages: syncMessage(world.messages, context),
    sim: world.sim
  };
  for (;;) {
    const raised = raisedKind(current, context.level, held);
    const step = stepBox(
      current.messages.box,
      context.now,
      context.level,
      raised !== null
    );
    current = {
      messages: { ...current.messages, waiting: step.waiting },
      sim: current.sim
    };
    if (step.close) {
      current = closeMessage(current, context);
    }
    if (!step.open || current.messages.box || !raised) {
      break;
    }
    current = raise(current, raised, context);
    decision ||= raised === 'meeting' || raised === 'fight';
    if (!current.messages.box) {
      break;
    }
  }
  return {
    ...current,
    decision,
    resumed: wasWaiting && !current.messages.waiting
  };
};
