import {
  WAR_EVENT_MESSAGES,
  takeAnnouncement,
  type SimState
} from '../sim/index';

// The War Event announcements on the Campaign Level
// (docs/spec/war-events.md, "Announcements on screen";
// finding:ui-war-event-messages): a one-line box with no buttons at the
// top left, up for 200 frames while game time runs on. A pure state
// machine over real time in milliseconds, like the combat windows.

const FRAME_MS = 20;
export const WAR_EVENT_MESSAGE_MS = 200 * FRAME_MS;

// The original's box sizes, Saruman's narrower than the Dark Lord's.
export const WAR_EVENT_BOXES = {
  4: { height: 24, width: 144, x: 10, y: 5 },
  7: { height: 24, width: 160, x: 10, y: 5 }
};

export interface WarEventMessage {
  event: 4 | 7;
  // Real time left on screen, kept while another window holds the box.
  remaining: number;
  text: string;
  until: number;
}

// Advance to `now`. `free` is whether the message box is free of the
// fight's windows: while it is not, the message waits, its time kept.
// When the box is free and empty, the oldest waiting announcement is
// taken from the sim and shown, so each is shown once, in order.
export const stepWarEventMessage = (
  message: WarEventMessage | null,
  sim: SimState,
  now: number,
  free: boolean
): { message: WarEventMessage | null; sim: SimState } => {
  if (!free) {
    return {
      message: message && {
        ...message,
        until: now + message.remaining
      },
      sim
    };
  }
  if (message && now < message.until) {
    return { message: { ...message, remaining: message.until - now }, sim };
  }
  const taken = takeAnnouncement(sim);
  if (!taken.announcement) {
    return { message: null, sim };
  }
  const { event } = taken.announcement;
  return {
    message: {
      event,
      remaining: WAR_EVENT_MESSAGE_MS,
      text: WAR_EVENT_MESSAGES[event],
      until: now + WAR_EVENT_MESSAGE_MS
    },
    sim: taken.state
  };
};

export const drawWarEventMessage = (
  ctx: CanvasRenderingContext2D,
  message: WarEventMessage
): void => {
  const box = WAR_EVENT_BOXES[message.event];
  ctx.fillStyle = '#000';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(message.text, box.x + 6, box.y + 8, box.width - 12);
};
