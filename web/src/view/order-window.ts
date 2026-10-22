import {
  LAST_GOOD_ENTRY,
  placeAt,
  type Force,
  type Place,
  type Point
} from '../sim/index';
import { forceAtPoint } from './campaign-level';
import { measureLines, type FontMetrics } from './font';
import { forceWindowLines } from './force-window';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// Giving an Order (finding:ui-giving-an-order): select the arrow
// icon, click a Force, then click a destination. Clicking the
// Force opens the window at the top left listing its members;
// clicking a member's name gives the Order to that member and its
// followers instead of the whole Force
// (finding:movement-ordering-part-of-a-force). While a destination
// is being chosen the pointer carries the word "TO". It is laid out
// as the info window it replaces (see force-window.ts); the highlight
// of the chosen member is provisional.

export type OrderState =
  | { kind: 'idle' }
  | { kind: 'pick-force' }
  | { kind: 'pick-destination'; leaderIndex: number; selected: number };

export const IDLE_ORDER: OrderState = { kind: 'idle' };

// The arrow icon starts an Order, or cancels one in progress.
export const toggleOrder = (state: OrderState): OrderState =>
  state.kind === 'idle' ? { kind: 'pick-force' } : IDLE_ORDER;

// Clicking a Good Force while picking one moves to choosing its
// destination, whole Force selected by default; whether it takes the
// Order is the sim's roll (finding:movement-orders-accepted-by-allegiance-roll).
// The original picks the first Good row listed near the click, and
// rows are in roster order, so where icons overlap the lowest-numbered
// Good Force is picked, not the one drawn on top: a Force parked on a
// Stronghold is picked over its higher-numbered Garrison.
export const pickForceAt = (
  state: OrderState,
  forces: Force[],
  point: Point
): OrderState => {
  if (state.kind !== 'pick-force') {
    return state;
  }
  const picked = forces
    .filter(
      force =>
        force.onMap &&
        force.leader.index >= 1 &&
        force.leader.index <= LAST_GOOD_ENTRY &&
        forceAtPoint([force], point)
    )
    .reduce<Force | null>(
      (best, force) =>
        !best || force.leader.index < best.leader.index ? force : best,
      null
    );
  if (!picked) {
    return state;
  }
  return {
    kind: 'pick-destination',
    leaderIndex: picked.leader.index,
    selected: picked.leader.index
  };
};

export const pickMember = (
  state: OrderState,
  memberIndex: number
): OrderState =>
  state.kind === 'pick-destination'
    ? { ...state, selected: memberIndex }
    : state;

export interface OrderWindowOption {
  height: number;
  label: string;
  memberIndex: number;
  width: number;
  x: number;
  y: number;
}

export interface OrderWindow {
  height: number;
  options: OrderWindowOption[];
  width: number;
  x: number;
  y: number;
}

const LINE_HEIGHT = 9;
const INSET_X = 10;
const INSET_Y = 8;
const X = 8;
const Y = 8;
const MAX_WIDTH = 240;

// Where the Leader is currently heading, as the window lists it: a
// Place name when the destination is a Place's position.
const headingLabel = (force: Force, places: Place[]): string => {
  const destination = force.leader.destination;
  if (!destination) {
    return '';
  }
  const place = placeAt(places, destination);
  return place ? ` -> ${place.name}` : ` -> ${destination.x},${destination.y}`;
};

export const layoutOrderWindow = (
  font: FontMetrics,
  force: Force,
  places: Place[]
): OrderWindow => {
  const lines = forceWindowLines(force);
  const heading = headingLabel(force, places);
  if (heading) {
    lines[0] = `${lines[0]}${heading}`;
  }
  const width = Math.min(
    MAX_WIDTH,
    Math.max(1, measureLines(font, lines)) + INSET_X * 2
  );
  return {
    height: lines.length * LINE_HEIGHT + INSET_Y * 2,
    options: force.members.map((member, i) => ({
      height: LINE_HEIGHT,
      label: lines[i]!,
      memberIndex: member.index,
      width: width - INSET_X * 2,
      x: X + INSET_X,
      y: Y + INSET_Y + i * LINE_HEIGHT
    })),
    width,
    x: X,
    y: Y
  };
};

export const orderWindowOptionAt = (
  window: OrderWindow,
  px: number,
  py: number
): OrderWindowOption | undefined =>
  window.options.find(
    option =>
      px >= option.x &&
      px < option.x + option.width &&
      py >= option.y &&
      py < option.y + option.height
  );

export const isInOrderWindow = (
  window: OrderWindow,
  px: number,
  py: number
): boolean =>
  px >= window.x &&
  px < window.x + window.width &&
  py >= window.y &&
  py < window.y + window.height;

export const drawOrderWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: OrderWindow,
  selected: number
): void => {
  drawWindowFrame(ctx, style, window);
  for (const option of window.options) {
    windowText(
      ctx,
      style,
      option.label,
      option.x,
      option.y,
      option.memberIndex === selected ? style.colours.red : style.colours.text
    );
  }
};

// The word "TO" the arrow carries while a destination is chosen
// (finding:ui-giving-an-order), drawn beside the pointer on a scrap of
// the windows' parchment.
export const drawOrderPointerTag = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  pointer: Point
): void => {
  ctx.fillStyle = style.colours.fill;
  ctx.fillRect(pointer.x + 6, pointer.y + 6, 16, 11);
  ctx.strokeStyle = style.colours.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(pointer.x + 6.5, pointer.y + 6.5, 15, 10);
  windowText(ctx, style, 'TO', pointer.x + 10, pointer.y + 8);
};
