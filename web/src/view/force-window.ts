import type { Force } from '../sim/index';

// The window at the top left of the screen that says who, what or
// where the player is pointing at (manual, pdf-p16;
// finding:ui-campaign-level-display). For a Force it lists the whole
// Force: the Leader first, and those following immediately after,
// indented a small amount, as the manual describes the Orders window's
// list. Units are shown with their strength so two Units of a kind
// can be told apart. Layout and lettering follow the Game Speed
// window's provisional style until the original window graphics and
// font are identified (see speed-window.ts).

export interface InfoWindow {
  height: number;
  lines: string[];
  width: number;
  x: number;
  y: number;
}

const LINE_HEIGHT = 10;
const PADDING = 4;
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
    height: lines.length * LINE_HEIGHT + PADDING * 2,
    lines,
    width: Math.min(MAX_WIDTH, longest * CHAR_WIDTH + PADDING * 2 + 2),
    x: 2,
    y: 2
  };
};

export const drawInfoWindow = (
  ctx: CanvasRenderingContext2D,
  window: InfoWindow
): void => {
  ctx.fillStyle = '#000';
  ctx.fillRect(window.x, window.y, window.width, window.height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    window.x + 0.5,
    window.y + 0.5,
    window.width - 1,
    window.height - 1
  );
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  window.lines.forEach((line, i) => {
    ctx.fillText(
      line,
      window.x + PADDING,
      window.y + PADDING + i * LINE_HEIGHT
    );
  });
};
