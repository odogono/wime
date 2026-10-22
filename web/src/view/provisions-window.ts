import {
  OBJECTS,
  VISION_TEXT,
  applyObject,
  putDownList,
  putDownObject,
  takeList,
  takeObject,
  usableList,
  type Point,
  type SimState,
  type UseOutcome
} from '../sim/index';
import { textKey } from './assets';
import { drawTip } from './encounter-talk';
import { measureText, wrapText, type FontMetrics } from './font';
import { FRAME_MS } from './tick-driver';
import {
  drawWindowFrame,
  windowText,
  type Box,
  type WindowStyle
} from './window-frame';

// The provisions sack's windows on the Animation Level
// (docs/spec/objects.md, "Put Down, Take and Use"). The sack opens a
// menu for the chosen Character; each choice opens a list of objects,
// and choosing one acts on the sim and shows a message. A pure state
// machine over real time in milliseconds. Positions are the original's,
// in lo-res pixels, within the shared frame
// (finding:ui-window-frame-tiles), lettered in lord/10
// (finding:ui-text-font-lord-10).

export type ProvisionsAction = 'put-down' | 'take' | 'use';

export interface ProvisionsButton extends Box {
  label: string;
  // The action a menu button opens, or the object a list line names.
  value: ProvisionsAction | number;
}

export type ProvisionsWindow =
  | {
      box: Box;
      buttons: ProvisionsButton[];
      chosen: number;
      heading: string;
      kind: 'menu' | ProvisionsAction;
      until: number;
    }
  | { box: Box; kind: 'message'; lines: string[]; until: number };

// A window with buttons is answered with its default, closing it,
// after 1,020 frames on the Animation Level; a message without buttons
// closes after 200 (finding:ui-provisions-window,
// finding:ui-object-list-empty-messages).
export const CHOICE_MS = 1020 * FRAME_MS;
export const MESSAGE_MS = 200 * FRAME_MS;

const TEXT_X = 10;
const TEXT_Y = 8;
const LINE_HEIGHT = 10;

const message = (
  lines: string[],
  width: number,
  now: number,
  height = 24
): ProvisionsWindow => ({
  box: { height, width, x: 10, y: 5 },
  kind: 'message',
  lines,
  until: now + MESSAGE_MS
});

// A button's clickable area starts a pixel above its text and is four
// wider (code+0x03a54, finding:ui-provisions-window). A framed button
// below another at the same x takes that one's width, so a column of
// them is as wide as its first label
// (finding:ui-stacked-buttons-share-a-width).
const button = (
  font: FontMetrics,
  x: number,
  y: number,
  label: string,
  value: ProvisionsButton['value'],
  textWidth = measureText(font, label)
): ProvisionsButton => ({
  height: font.height,
  label,
  value,
  width: textWidth + 4,
  x,
  y: y - 1
});

// The Character who acts: the selected one if it is in the Force on
// screen and awake, else the first awake member
// (finding:ui-provisions-chosen-character).
export const chooseCharacter = (
  sim: SimState,
  party: number[],
  previous: number | null
): number | null => {
  const awake = party.filter(index => (sim.roster[index]?.state ?? 0) !== 0);
  const chosen =
    previous !== null && awake.includes(previous) ? previous : awake[0];
  return chosen === undefined || sim.roster[chosen]?.isUnit ? null : chosen;
};

const MENU: readonly [string, ProvisionsAction][] = [
  ['Put down an object', 'put-down'],
  ['Take an object', 'take'],
  ['Use an object', 'use']
];

// The sack's menu at (168, 5), 112 by 68 (finding:ui-provisions-window).
export const openProvisions = (
  font: FontMetrics,
  sim: SimState,
  party: number[],
  previous: number | null,
  now: number
): ProvisionsWindow => {
  const chosen = chooseCharacter(sim, party, previous);
  if (chosen === null) {
    return message(
      ['Please select an active member', 'of the party.'],
      100,
      now,
      34
    );
  }
  const box = { height: 68, width: 112, x: 168, y: 5 };
  const columnWidth = measureText(font, MENU[0]![0]);
  return {
    box,
    buttons: MENU.map(([label, action], i) =>
      button(font, box.x + 20, box.y + 22 + 15 * i, label, action, columnWidth)
    ),
    chosen,
    heading: `Would ${sim.roster[chosen]!.name} like to...`,
    kind: 'menu',
    until: now + CHOICE_MS
  };
};

const HEADINGS: Record<ProvisionsAction, string> = {
  'put-down': 'drop',
  take: 'get',
  use: 'use'
};

// A list at (112, 5), 176 wide and 28 plus 10 a line deep, or the
// message for an empty one (finding:ui-object-list-window,
// finding:ui-object-list-empty-messages).
export const openObjectList = (
  font: FontMetrics,
  sim: SimState,
  chosen: number,
  action: ProvisionsAction,
  position: Point,
  now: number
): ProvisionsWindow => {
  const name = sim.roster[chosen]!.name;
  const objects =
    action === 'put-down'
      ? putDownList(sim, chosen)
      : action === 'take'
        ? takeList(sim, position)
        : usableList(sim, chosen);
  if (!objects.length) {
    switch (action) {
      case 'put-down':
        return message(
          [`${name} is unwilling to part with anything.`],
          176,
          now
        );
      case 'take':
        return message(['There are no objects here.'], 160, now);
      case 'use':
        return message([`${name} has nothing which is 'usable'.`], 176, now);
    }
  }
  const box = { height: 28 + 10 * objects.length, width: 176, x: 112, y: 5 };
  return {
    box,
    buttons: objects.map((object, i) =>
      button(
        font,
        box.x + 15,
        box.y + 20 + 10 * i,
        OBJECTS[object]!.name,
        object
      )
    ),
    chosen,
    heading: `Select the object for ${name} to ${HEADINGS[action]}:`,
    kind: action,
    until: now + CHOICE_MS
  };
};

// What Use shows, in its box's width and depth
// (finding:objects-use-message-boxes). The Palantír shares the session's
// tip history with advisors (finding:ui-advisors-share-advice). The
// texts keep their own line breaks, which fit these boxes in lord/10.
const effectMessage = (
  font: FontMetrics,
  outcome: UseOutcome | null,
  name: string,
  texts: Map<string, string>,
  givenTips: Set<number>,
  random: (n: number) => number,
  now: number
): ProvisionsWindow | null => {
  const text = (id: number): string =>
    (texts.get(textKey('BScene.res', id)) ?? '').trim();
  if (!outcome) {
    return null;
  }
  switch (outcome.use) {
    case 'blue-potion':
      return message(
        [`${name} feels ${outcome.healed ? 'much better' : 'no effect'}.`],
        128,
        now
      );
    case 'black-flask':
      return message([`${name} ${text(34)}`], 192, now);
    case 'glowing-vial':
      return message([`${name} ${text(35)}`], 208, now);
    case 'rope':
      return message([text(36)], 160, now);
    case 'token': {
      const dimensions: Record<number, [number, number]> = {
        38: [256, 24],
        39: [192, 24],
        40: [256, 49],
        41: [192, 24],
        42: [256, 56],
        43: [208, 24],
        44: [256, 48],
        45: [224, 24]
      };
      const [width, height] = dimensions[outcome.text]!;
      return message(
        wrapText(font, text(outcome.text), width - 2 * TEXT_X),
        width,
        now,
        height
      );
    }
    case 'palantir': {
      // As with advisors, use a proverb once all tips have been given.
      const id = outcome.vision
        ? VISION_TEXT
        : (drawTip(givenTips, random) ?? 28 + random(6));
      return message(
        [
          `Looking deep into the crystal, ${name} sees a vision:`,
          ...wrapText(font, text(id), 256 - 2 * TEXT_X)
        ],
        256,
        now,
        64
      );
    }
  }
};

// Choose an object from a list: act on the sim and show what happened
// (finding:objects-take-message,
// finding:objects-put-down-message-after-the-animation). The caller
// sends the figure on its errand and holds Put Down's message until the
// object is down (main.ts, startErrand).
export const chooseObject = (
  font: FontMetrics,
  sim: SimState,
  chosen: number,
  action: ProvisionsAction,
  object: number,
  position: Point,
  texts: Map<string, string>,
  givenTips: Set<number>,
  random: (n: number) => number,
  now: number
): { sim: SimState; window: ProvisionsWindow | null } => {
  const name = sim.roster[chosen]!.name;
  const objectName = OBJECTS[object]!.name;
  switch (action) {
    case 'put-down':
      return {
        sim: putDownObject(sim, chosen, object, position),
        window: message([`${name} puts down ${objectName}.`], 176, now)
      };
    case 'take':
      return {
        sim: takeObject(sim, chosen, object, position),
        window: message([`${name} goes to pick up ${objectName}.`], 192, now)
      };
    case 'use': {
      const result = applyObject(sim, chosen, object, position);
      return {
        sim: result.state,
        window: effectMessage(
          font,
          result.outcome,
          name,
          texts,
          givenTips,
          random,
          now
        )
      };
    }
  }
};

export const provisionsButtonAt = (
  window: ProvisionsWindow,
  point: { x: number; y: number }
): ProvisionsButton | undefined =>
  window.kind === 'message'
    ? undefined
    : window.buttons.find(
        b =>
          point.x >= b.x &&
          point.x < b.x + b.width &&
          point.y >= b.y &&
          point.y < b.y + b.height
      );

// A window with buttons stops the clock (finding:ui-provisions-window).
export const holdsClock = (window: ProvisionsWindow | null): boolean =>
  window !== null && window.kind !== 'message';

export const expired = (window: ProvisionsWindow, now: number): boolean =>
  now >= window.until;

// Headings in colour 8, everything else in colour 5; menu buttons are
// framed, list lines are not (finding:ui-message-box-text-colour,
// finding:ui-object-list-window).
export const drawProvisionsWindow = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  window: ProvisionsWindow
): void => {
  const box = drawWindowFrame(ctx, style, window.box);
  if (window.kind === 'message') {
    window.lines.forEach((line, i) =>
      windowText(
        ctx,
        style,
        line,
        box.x + TEXT_X,
        box.y + TEXT_Y + i * LINE_HEIGHT
      )
    );
    return;
  }
  windowText(
    ctx,
    style,
    window.heading,
    box.x + TEXT_X,
    box.y + TEXT_Y,
    style.colours.blue
  );
  ctx.strokeStyle = style.colours.text;
  ctx.lineWidth = 1;
  for (const b of window.buttons) {
    if (window.kind === 'menu') {
      // From (x - 1, y - 2), 6 wider and 2 deeper than the label
      // (finding:ui-message-box-text-colour).
      ctx.strokeRect(b.x - 0.5, b.y - 0.5, b.width + 1, b.height + 1);
    }
    windowText(ctx, style, b.label, b.x + 2, b.y + 1);
  }
};
