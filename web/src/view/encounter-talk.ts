// Advisor talks (docs/spec/encounters.md, "The talk"). All choices and
// the session's tip history belong to the view, never the saved sim.
import type { RosterEntry } from '../sim/index';
import { drawFigures, stepStage, type Stage } from './animation-level';
import { textKey, type AnimationAssets } from './assets';
import {
  STOPPED,
  newFigure,
  startScript,
  type ScriptWorld
} from './figure-script';
import { measureLines, wrapText } from './font';
import { FRAME_MS } from './tick-driver';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// Provisional arrival and advice pacing (docs/spec/encounters.md).
export const NOTICE_MS = 200 * FRAME_MS;

const GREETINGS = ['Greetings ', 'Hello ', 'Welcome ', ''];
const FAREWELLS = ['Farewell!', 'Good luck!', 'Good journey!', 'Goodbye!'];
const TIP_IDS = Array.from({ length: 20 }, (_, i) => i + 8);

// Pick uniformly from the remaining tips. Unlike an unbounded reroll,
// this also terminates with a constant random source and after all 20.
export const drawTip = (
  given: Set<number>,
  random: (n: number) => number
): number | null => {
  const remaining = TIP_IDS.filter(id => !given.has(id));
  if (!remaining.length) {
    return null;
  }
  const id = remaining[random(remaining.length)]!;
  given.add(id);
  return id;
};

// The three boxes and the tips each one gives, drawn against a copy of
// the history so a talk left early spends only the tips it showed.
const planAdvice = (
  name: string,
  texts: Map<string, string>,
  history: Set<number>,
  random: (n: number) => number
): { boxes: string[]; tips: number[][] } => {
  const given = new Set(history);
  const tips: number[][] = [];
  const spent = (): number[] =>
    [...given].filter(id => !history.has(id) && !tips.flat().includes(id));
  const text = (id: number): string => {
    const value = texts.get(textKey('BScene.res', id));
    if (value === undefined) {
      throw new Error(`Missing advisor text BScene.res CSTR ${id}`);
    }
    return value.replaceAll(/\s+/g, ' ').trim();
  };
  const proverb = (): string => text(28 + random(6));
  const tip = (): string => {
    const id = drawTip(given, random);
    // provisional: once all tips are spent, use proverbs, never repeats.
    return id === null ? proverb() : text(id);
  };
  const greeting = `${GREETINGS[random(4)]}${name}${text(random(4))}`;
  tips.push([]);
  const advice = tip();
  tips.push(spent());
  const partingId = 4 + random(5);
  // CSTR 8 is both the last parting prefix and the first tip. Account
  // for it in the same history so it cannot repeat through this path.
  const parting = text(partingId === 8 && given.has(8) ? 4 : partingId);
  if (partingId === 8) {
    given.add(8);
  }
  const last = random(4) === 0 ? tip() : proverb();
  tips.push(spent());
  return {
    boxes: [greeting, advice, `${parting} ${last} ${FAREWELLS[random(4)]}`],
    tips
  };
};

export const adviceBoxes = (
  name: string,
  texts: Map<string, string>,
  given: Set<number>,
  random: (n: number) => number
): string[] => {
  const { boxes, tips } = planAdvice(name, texts, given, random);
  for (const id of tips.flat()) {
    given.add(id);
  }
  return boxes;
};

export interface EncounterTalk {
  advisor: Stage;
  boxes: string[];
  // The session's tip history, and the tips each box adds when shown.
  given: Set<number>;
  // -1 is the one-line meeting box while the advisor arrives.
  page: number;
  party: Stage;
  picture: number | null;
  started: number;
  text: string;
  tips: number[][];
  until: number;
}

// provisional: an arrival takes four seconds; each advice box waits
// at least four seconds, or long enough to read it. A press advances.
const boxDuration = (text: string): number =>
  Math.max(NOTICE_MS, text.length * 55);

export const startEncounterTalk = (
  a: RosterEntry,
  b: RosterEntry,
  stage: Stage,
  world: Omit<ScriptWorld, 'laggardLine'>,
  texts: Map<string, string>,
  given: Set<number>,
  random: (n: number) => number,
  now: number
): EncounterTalk => {
  // Hold the party together on the left, with room for the advisor.
  const rightmost = Math.max(0, ...stage.figures.map(figure => figure.x));
  const party = {
    ...stage,
    figures: stage.figures.map(figure => ({
      ...figure,
      x: Math.max(16, 110 + figure.x - rightmost)
    }))
  };
  const figure = startScript(
    newFigure(
      { ...world, laggardLine: 0 },
      b.figure,
      0,
      330,
      165,
      151,
      b.index
    ),
    2
  );
  const { boxes, tips } = planAdvice(a.name, texts, given, random);
  return {
    advisor: {
      figures:
        b.figure < 20
          ? [{ ...figure, flipped: true, next: Math.floor(now / 20) }]
          : [],
      party: 0
    },
    boxes,
    given,
    page: -1,
    party,
    picture: b.figure >= 20 ? b.figure : null,
    started: now,
    text: `${a.name} meets ${b.name}.`,
    tips,
    until: now + NOTICE_MS
  };
};

export const advanceEncounterTalk = (
  talk: EncounterTalk,
  now: number
): EncounterTalk | null => {
  const page = talk.page + 1;
  const text = talk.boxes[page];
  if (text === undefined) {
    return null;
  }
  for (const id of talk.tips[page] ?? []) {
    talk.given.add(id);
  }
  return {
    ...talk,
    page,
    text,
    until: now + boxDuration(text)
  };
};

export const stepEncounterTalk = (
  talk: EncounterTalk,
  world: Omit<ScriptWorld, 'laggardLine'>,
  now: number
): EncounterTalk | null => {
  const progress = Math.min(1, Math.max(0, (now - talk.started) / NOTICE_MS));
  const advisor = stepStage(talk.advisor, world, Math.floor(now / 20));
  const stepped = {
    ...talk,
    advisor: {
      ...advisor,
      figures: advisor.figures.map(figure => ({
        ...figure,
        next: progress === 1 || talk.page >= 0 ? STOPPED : figure.next,
        x: Math.round(330 - 150 * (talk.page >= 0 ? 1 : progress))
      }))
    }
  };
  return now >= talk.until ? advanceEncounterTalk(stepped, now) : stepped;
};

// The box's text keeps the resource's own line breaks, wrapping only a
// line wider than the box (finding:ui-text-font-lord-10). The box's
// width and depth are provisional: it fits its text, up to 272 wide.
const NOTICE_MAX_WIDTH = 272;

export const drawEncounterNotice = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  text: string
): void => {
  const font = style.font.metrics;
  const lines = wrapText(font, text, NOTICE_MAX_WIDTH - 20);
  const box = drawWindowFrame(ctx, style, {
    height: 16 + lines.length * font.height,
    width: Math.min(NOTICE_MAX_WIDTH, measureLines(font, lines) + 20),
    x: 8,
    y: 5
  });
  lines.forEach((line, i) =>
    windowText(ctx, style, line, box.x + 10, box.y + 8 + i * font.height)
  );
};

export const drawEncounterTalk = (
  ctx: CanvasRenderingContext2D,
  assets: AnimationAssets,
  talk: EncounterTalk
): void => {
  drawFigures(ctx, assets, talk.party);
  drawFigures(ctx, assets, talk.advisor);
  const picture =
    talk.picture === null ? null : assets.strips.get(talk.picture);
  if (picture) {
    ctx.drawImage(picture, 280 - picture.width, 182 - picture.height);
  }
  drawEncounterNotice(ctx, assets.window, talk.text);
};
