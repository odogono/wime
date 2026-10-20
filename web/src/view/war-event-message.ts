import {
  WAR_EVENT_MESSAGES,
  takeAnnouncement,
  type SimState
} from '../sim/index';
import { messageDurationMs } from './message-timing';
import type { GameSpeed } from './tick-driver';
import { drawWindowFrame, type WindowStyle } from './window-frame';

// The War Event announcements on the Campaign Level
// (docs/spec/war-events.md, "Announcements on screen";
// finding:ui-war-event-messages): a one-line box with no buttons at the
// top left, up for 60 or 200 frames while game time runs on. A pure state
// machine over real time in milliseconds, like the combat windows.

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
  free: boolean,
  speed: GameSpeed = 'normal'
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
  const duration = messageDurationMs(speed);
  return {
    message: {
      event,
      remaining: duration,
      text: WAR_EVENT_MESSAGES[event],
      until: now + duration
    },
    sim: taken.state
  };
};

export const drawWarEventMessage = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  message: WarEventMessage
): void => {
  const box = drawWindowFrame(ctx, style, WAR_EVENT_BOXES[message.event]);
  // The original's message box writes its text 10 pixels in and 8 down.
  ctx.fillText(message.text, box.x + 10, box.y + 8, box.width - 20);
};
