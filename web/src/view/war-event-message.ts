import {
  WAR_EVENT_MESSAGES,
  takeAnnouncement,
  type SimState
} from '../sim/index';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// The War Event announcements (docs/spec/war-events.md, "Announcements
// on screen"; finding:ui-war-event-messages): a one-line box with no
// buttons at the top left, while game time runs on. When and for how
// long it shows is the message box's (message-box.ts).

// The original's box sizes, Saruman's narrower than the Dark Lord's.
export const WAR_EVENT_BOXES = {
  4: { height: 24, width: 144, x: 10, y: 5 },
  7: { height: 24, width: 160, x: 10, y: 5 }
};

export interface WarEventMessage {
  event: 4 | 7;
  text: string;
}

// Take the oldest waiting announcement from the sim as it is about to be
// shown, so each is shown once, in order.
export const takeWarEventMessage = (
  sim: SimState
): { message: WarEventMessage | null; sim: SimState } => {
  const taken = takeAnnouncement(sim);
  if (!taken.announcement) {
    return { message: null, sim };
  }
  const { event } = taken.announcement;
  return {
    message: { event, text: WAR_EVENT_MESSAGES[event] },
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
  windowText(ctx, style, message.text, box.x + 10, box.y + 8);
};
