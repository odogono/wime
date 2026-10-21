import {
  OBJECTS,
  statusLine,
  type Place,
  type RosterEntry
} from '../sim/index';
import type { Stage } from './animation-level';
import type { FrameRecord } from './figure-script';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// Status on the Animation Level (docs/spec/animation-level.md): a click
// on a figure shows its entry's status line and selects it
// (finding:ui-animation-level-clicking-a-figure-selects-it), and the eye
// shows the selected Character's status
// (finding:ui-animation-level-eye-shows-the-selected-status). Both are
// boxes with no buttons at the top left.

// The figure under a point: the nearest, highest depth first, and of
// equal depth the one added first; its box is its current frame
// (finding:ui-animation-level-click-takes-the-frontmost-figure).
export const figureAt = (
  stage: Stage,
  frames: (frml: number) => readonly FrameRecord[],
  point: { x: number; y: number }
): number | null => {
  let best: { depth: number; owner: number } | null = null;
  for (const figure of stage.figures) {
    const frame = frames(figure.frml)[figure.frame];
    if (
      !frame ||
      point.x < figure.x ||
      point.x >= figure.x + frame.width ||
      point.y < figure.y ||
      point.y >= figure.y + frame.height
    ) {
      continue;
    }
    if (!best || figure.depth > best.depth) {
      best = { depth: figure.depth, owner: figure.owner };
    }
  }
  return best?.owner ?? null;
};

// A clicked entry becomes the selected Character when it is one of
// roster entries 1 to 78: the Good side and Gollum.
export const LAST_SELECTABLE = 78;
export const isSelectable = (index: number): boolean =>
  index >= 1 && index <= LAST_SELECTABLE;

export interface StatusLine {
  // The heading is in colour 8, the rest in colour 5.
  heading?: boolean;
  text: string;
  x: number;
  y: number;
}

export interface StatusBox {
  height: number;
  lines: StatusLine[];
  width: number;
}

const BOX_X = 10;
const BOX_Y = 5;
const TEXT_X = 10;

// The clicked figure's line (code+0x05678).
export const figureStatus = (
  roster: RosterEntry[],
  places: Place[],
  index: number
): StatusBox => ({
  height: 24,
  lines: [{ text: statusLine(roster, places, index), x: TEXT_X, y: 8 }],
  width: 208
});

export const EYE_HEADING =
  'Through the mist swirling within the glass you perceive...';
export const NOBODY_SELECTED =
  'Please select someone before requesting status.';
const MORALE = ['poor', 'poor', 'fair', 'good', 'excellent'];
const HEALTH = [
  'near death',
  'gravely wounded',
  'wounded',
  'slightly wounded',
  'hale and hardy'
];

// A run of object names joined as the original joins them (data+0x1d0e):
// "A.", "A and B.", "A, B, and C.". A run that goes on from an earlier
// line always has the comma: "E, and F.".
const joinNames = (names: string[], goesOn: boolean): string =>
  names
    .map((name, i) => {
      const left = names.length - i - 1;
      if (left === 0) {
        return `${name}.`;
      }
      if (left === 1) {
        return names.length === 2 && !goesOn ? `${name} and ` : `${name}, and `;
      }
      return `${name}, `;
    })
    .join('');

// The lines about what a Character carries, four names to a line and
// at most eight; the second line goes on from the first.
export const carriedLines = (objects: readonly number[]): string[] => {
  const names = [...objects]
    .sort((a, b) => a - b)
    .slice(0, 8)
    .map(object => OBJECTS[object]?.name ?? '');
  if (names.length === 0) {
    return [];
  }
  const first = names.slice(0, 4);
  const rest = names.slice(4);
  if (rest.length === 0) {
    return [`He has ${joinNames(first, false)}`];
  }
  // With five the first line ends "D, and "; with more it ends "D, "
  // and the second joins its own names.
  const firstLine =
    rest.length === 1
      ? `He has ${first.join(', ')}, and `
      : `He has ${first.join(', ')}, `;
  return [firstLine, joinNames(rest, true)];
};

// The eye's status of the selected entry, or the request to select
// someone (code+0x075cc).
export const eyeStatus = (
  roster: RosterEntry[],
  places: Place[],
  selected: number | null
): StatusBox => {
  const entry = selected === null ? undefined : roster[selected];
  if (!entry || selected === null) {
    return {
      height: 24,
      lines: [{ text: NOBODY_SELECTED, x: TEXT_X, y: 8 }],
      width: 196
    };
  }
  const lines: StatusLine[] = [
    { heading: true, text: EYE_HEADING, x: TEXT_X, y: 8 },
    { text: statusLine(roster, places, selected), x: TEXT_X, y: 18 }
  ];
  const carried = entry.strength === 1 ? carriedLines(entry.objects) : [];
  if (entry.strength > 1) {
    const rating = Math.floor(
      (entry.strength * 4) / Math.max(1, entry.startingStrength)
    );
    lines.push({
      text: `They have ${MORALE[Math.min(rating, 4)]} morale.`,
      x: TEXT_X,
      y: 28
    });
  } else if (entry.strength === 1) {
    const word = Math.floor((entry.health * 4) / Math.max(1, entry.maxHealth));
    lines.push({
      text: `He is ${HEALTH[Math.min(word, 4)]}.`,
      x: TEXT_X,
      y: 28
    });
    carried.forEach((text, i) => {
      lines.push({ text, x: i === 0 ? TEXT_X : 15, y: 38 + i * 10 });
    });
  }
  return {
    height:
      34 +
      (entry.strength === 1 ? 10 : 0) +
      (entry.objects.length > 0 ? 10 : 0) +
      (entry.objects.length > 4 ? 10 : 0),
    lines,
    width: 260
  };
};

export const drawStatusBox = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  status: StatusBox
): void => {
  const box = drawWindowFrame(ctx, style, {
    height: status.height,
    width: status.width,
    x: BOX_X,
    y: BOX_Y
  });
  for (const line of status.lines) {
    windowText(
      ctx,
      style,
      line.text,
      box.x + line.x,
      box.y + line.y,
      line.heading ? style.colours.blue : style.colours.text
    );
  }
};

// Whether a point is inside the box, which takes the click from any
// figure behind it.
export const insideStatusBox = (
  status: StatusBox,
  point: { x: number; y: number }
): boolean =>
  point.x >= BOX_X &&
  point.x < BOX_X + status.width &&
  point.y >= BOX_Y &&
  point.y < BOX_Y + status.height;
