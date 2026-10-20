import { closeCouncil, type SimState } from '../sim/index';
import { textKey } from './assets';
import { FRAME_MS } from './tick-driver';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// The Council of Elrond's message on the Campaign Level
// (docs/spec/council-of-elrond.md, "The message";
// finding:ui-council-of-elrond-message): a box with no buttons, up for
// 1200 frames while game time stands still, that cannot be dismissed.
// A pure state machine over real time in milliseconds, like the War
// Event announcements.

export const COUNCIL_MESSAGE_MS = 1200 * FRAME_MS;

export const COUNCIL_BOX = { height: 130, width: 240, x: 40, y: 20 };
// The text starts 20 pixels in and 20 down, a line every 10.
const TEXT_LEFT = 20;
const TEXT_TOP = 20;
const LINE_HEIGHT = 10;

export interface CouncilMessageWindow {
  lines: string[];
  until: number;
}

const textLines = (texts: Map<string, string>, id: number): string[] =>
  (texts.get(textKey('BScene.res', id)) ?? '').replace(/\n+$/, '').split('\n');

// BScene.res CSTR 46, then CSTR 47 with the Ring-bearer's name and
// " was", then CSTR 48.
export const councilMessageLines = (
  sim: SimState,
  texts: Map<string, string>
): string[] => {
  const name = sim.council
    ? (sim.roster[sim.council.ringBearer]?.name ?? '')
    : '';
  const [middle = ''] = textLines(texts, 47);
  return [
    ...textLines(texts, 46),
    `${middle}${name} was`,
    ...textLines(texts, 48)
  ];
};

// Advance to `now`. A Council waiting in the sim, new or restored, opens
// a fresh window; once its time is up the window closes and the sim
// lets game time run again.
export const stepCouncilMessage = (
  window: CouncilMessageWindow | null,
  sim: SimState,
  texts: Map<string, string>,
  now: number
): { sim: SimState; window: CouncilMessageWindow | null } => {
  if (!sim.council) {
    return { sim, window: null };
  }
  if (!window) {
    return {
      sim,
      window: {
        lines: councilMessageLines(sim, texts),
        until: now + COUNCIL_MESSAGE_MS
      }
    };
  }
  return now < window.until
    ? { sim, window }
    : { sim: closeCouncil(sim), window: null };
};

export const drawCouncilMessage = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: CouncilMessageWindow
): void => {
  const box = drawWindowFrame(ctx, style, COUNCIL_BOX);
  window.lines.forEach((line, i) => {
    windowText(
      ctx,
      style,
      line,
      box.x + TEXT_LEFT,
      box.y + TEXT_TOP + i * LINE_HEIGHT
    );
  });
};
