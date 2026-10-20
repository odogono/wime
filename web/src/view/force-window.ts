import type { Force } from '../sim/index';
import { drawWindowFrame, type WindowStyle } from './window-frame';

// The window at the top left of the screen that says who, what or
// where the player is pointing at (manual, pdf-p16;
// finding:ui-campaign-level-display). For a Force it lists the whole
// Force: the Leader first, and those following immediately after,
// indented a small amount, as the manual describes the Orders window's
// list. Units are shown with their strength so two Units of a kind
// can be told apart. The window is a framed box at (8, 8) with its
// lines 10 pixels in, 8 down and 9 apart, as captured in play
// (finding:ui-window-frame-tiles); the lettering is provisional until
// the original font is identified.

export interface InfoWindow {
  height: number;
  lines: string[];
  width: number;
  x: number;
  y: number;
}

const LINE_HEIGHT = 9;
const INSET_X = 10;
const INSET_Y = 8;
// The 8px monospace lettering is about 5px a character; the window is
// sized to its longest line and never wider than most of the screen.
const CHAR_WIDTH = 5;
const MAX_WIDTH = 240;

export const forceWindowLines = (force: Force): string[] =>
  force.members.map((member, i) => {
    const label = member.isUnit
      ? `${member.name} (${member.strength})`
      : member.name;
    return i === 0 ? label : `  ${label}`;
  });

export const layoutInfoWindow = (lines: string[]): InfoWindow => {
  const longest = Math.max(1, ...lines.map(line => line.length));
  return {
    height: lines.length * LINE_HEIGHT + INSET_Y * 2,
    lines,
    width: Math.min(MAX_WIDTH, longest * CHAR_WIDTH + INSET_X * 2),
    x: 8,
    y: 8
  };
};

export const drawInfoWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: InfoWindow
): void => {
  const box = drawWindowFrame(ctx, style, window);
  window.lines.forEach((line, i) => {
    ctx.fillText(line, box.x + INSET_X, box.y + INSET_Y + i * LINE_HEIGHT);
  });
};
