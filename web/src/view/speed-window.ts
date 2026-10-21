import { measureText, type FontMetrics } from './font';
import { BUTTONS_DEADLINE_FRAMES } from './message-box';
import { FRAME_MS, type GameSpeed } from './tick-driver';
import {
  drawWindowFrame,
  windowText,
  type Box,
  type WindowStyle
} from './window-frame';

// The Game Speed window the hourglass opens, "Rate of Time Passage"
// (docs/spec/time.md, finding:ui-game-speed-window): a box at (184, 5),
// 90 by 68, with a framed button for each speed. The current speed's
// button is lettered and framed in colour 10 and is the box's default.
// The clock holds while it is up, and after the deadline of a box with
// buttons it closes, pressing its default. Positions are the original's,
// in lo-res pixels (finding:ui-window-box-geometry).

export interface SpeedButton extends Box {
  label: string;
  speed: GameSpeed;
}

export interface SpeedWindow {
  box: Box;
  buttons: SpeedButton[];
  heading: string;
  // When it presses its default, the current speed; null for never, as
  // on the Full Map Level.
  until: number | null;
}

const BUTTONS: readonly [string, GameSpeed][] = [
  ['Very Hasty', 'very-hasty'],
  ['Hasty', 'hasty'],
  ['Normal', 'normal']
];

const TEXT_X = 10;
const TEXT_Y = 8;

export const openSpeedWindow = (
  font: FontMetrics,
  now: number,
  level: 'animation' | 'campaign' | 'full-map'
): SpeedWindow => {
  const box = { height: 68, width: 90, x: 184, y: 5 };
  // The buttons stand in a column at x 26, so all take the first's
  // width (finding:ui-stacked-buttons-share-a-width); a button's area
  // starts a pixel above its text and is 4 wider (code+0x03a54).
  const width = measureText(font, BUTTONS[0]![0]) + 4;
  return {
    box,
    buttons: BUTTONS.map(([label, speed], i) => ({
      height: font.height,
      label,
      speed,
      width,
      x: box.x + 26,
      y: box.y + 22 + 15 * i - 1
    })),
    heading: 'Rate of Time Passage',
    until:
      level === 'full-map'
        ? null
        : now +
          BUTTONS_DEADLINE_FRAMES[
            level === 'animation' ? 'animation' : 'campaign'
          ] *
            FRAME_MS
  };
};

export const speedAt = (
  window: SpeedWindow,
  px: number,
  py: number
): GameSpeed | undefined =>
  window.buttons.find(
    b => px >= b.x && px < b.x + b.width && py >= b.y && py < b.y + b.height
  )?.speed;

export const drawSpeedWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: SpeedWindow,
  current: GameSpeed
): void => {
  const box = drawWindowFrame(ctx, style, window.box);
  windowText(
    ctx,
    style,
    window.heading,
    box.x + TEXT_X,
    box.y + TEXT_Y,
    style.colours.blue
  );
  ctx.lineWidth = 1;
  for (const b of window.buttons) {
    const colour = b.speed === current ? style.colours.red : style.colours.text;
    // From (x - 1, y - 2), 6 wider and 2 deeper than the label
    // (finding:ui-message-box-text-colour).
    ctx.strokeStyle = colour;
    ctx.strokeRect(b.x - 0.5, b.y - 0.5, b.width + 1, b.height + 1);
    windowText(ctx, style, b.label, b.x + 2, b.y + 1, colour);
  }
};
