import { placeAt, type Force, type Place, type Point } from '../sim/index';
import { forceAtPoint } from './campaign-level';
import { forceWindowLines } from './force-window';

// Giving an Order (finding:ui-giving-an-order): select the arrow
// icon, click a Force, then click a destination. Clicking the
// Force opens the window at the top left listing its members;
// clicking a member's name gives the Order to that member and its
// followers instead of the whole Force
// (finding:movement-ordering-part-of-a-force). While a destination
// is being chosen the pointer carries the word "TO". Layout and
// lettering follow the other windows' provisional style until the
// original window graphics and font are identified.

export type OrderState =
  | { kind: 'idle' }
  | { kind: 'pick-force' }
  | { kind: 'pick-destination'; leaderIndex: number; selected: number };

export const IDLE_ORDER: OrderState = { kind: 'idle' };

// The arrow icon starts an Order, or cancels one in progress.
export const toggleOrder = (state: OrderState): OrderState =>
  state.kind === 'idle' ? { kind: 'pick-force' } : IDLE_ORDER;

// Clicking an active Force while picking one moves to choosing
// its destination, whole Force selected by default.
export const pickForceAt = (
  state: OrderState,
  forces: Force[],
  point: Point
): OrderState => {
  if (state.kind !== 'pick-force') {
    return state;
  }
  const force = forceAtPoint(forces, point);
  if (!force || !force.active || !force.onMap) {
    return state;
  }
  return {
    kind: 'pick-destination',
    leaderIndex: force.leader.index,
    selected: force.leader.index
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

const LINE_HEIGHT = 10;
const PADDING = 4;
const CHAR_WIDTH = 5;
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
  force: Force,
  places: Place[]
): OrderWindow => {
  const lines = forceWindowLines(force);
  const heading = headingLabel(force, places);
  if (heading) {
    lines[0] = `${lines[0]}${heading}`;
  }
  const longest = Math.max(1, ...lines.map(line => line.length));
  const width = Math.min(MAX_WIDTH, longest * CHAR_WIDTH + PADDING * 2 + 2);
  return {
    height: lines.length * LINE_HEIGHT + PADDING * 2,
    options: force.members.map((member, i) => ({
      height: LINE_HEIGHT,
      label: lines[i]!,
      memberIndex: member.index,
      width: width - PADDING * 2,
      x: 2 + PADDING,
      y: 2 + PADDING + i * LINE_HEIGHT
    })),
    width,
    x: 2,
    y: 2
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
  window: OrderWindow,
  selected: number
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
  for (const option of window.options) {
    ctx.fillStyle = option.memberIndex === selected ? '#ff0' : '#fff';
    ctx.fillText(option.label, option.x, option.y + 1);
  }
};

// The word "TO" the arrow carries while a destination is chosen
// (finding:ui-giving-an-order), drawn beside the pointer.
export const drawOrderPointerTag = (
  ctx: CanvasRenderingContext2D,
  pointer: Point
): void => {
  ctx.fillStyle = '#000';
  ctx.fillRect(pointer.x + 6, pointer.y + 6, 16, 11);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(pointer.x + 6.5, pointer.y + 6.5, 15, 10);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText('TO', pointer.x + 8, pointer.y + 8);
};
