// Advisor talks (docs/spec/encounters.md, "The talk"). A walking
// advisor's own script runs the talk; a still picture's runs on the
// clock. All choices and the session's tip history belong to the view,
// never the saved sim.
import type { RosterEntry } from '../sim/index';
import { drawFigures, stepStage, type Stage } from './animation-level';
import { textKey, type AnimationAssets } from './assets';
import {
  STOPPED,
  newFigure,
  runEntries,
  type Figure,
  type ScriptWorld,
  type TalkEvent
} from './figure-script';
import { measureLines, wrapText } from './font';
import { LINGER_FRAMES } from './message-timing';
import { FRAME_MS } from './tick-driver';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

type World = Omit<ScriptWorld, 'laggardLine'>;
type Random = (n: number) => number;

const GREETINGS = ['Greetings ', 'Hello ', 'Welcome ', ''];
const FAREWELLS = ['Farewell!', 'Good luck!', 'Good journey!', 'Goodbye!'];
const FIRST_TIP = 8;
const TIPS = 20;
const TIP_TRIES = 50;

// A box without buttons stays 1,500 frames on the Animation Level
// unless a press or the next box closes it
// (finding:ui-message-box-timeouts-by-level).
export const BOX_MS = (200 + LINGER_FRAMES.animation) * FRAME_MS;
// A still picture's parting follows its greeting after 600 frames
// (finding:ui-advisor-talk-runs-on-the-advisors-script).
export const PICTURE_PARTING_MS = 600 * FRAME_MS;

// The party walks to its line, stands, then walks on; a walking
// advisor walks to its line, then talks (code+0x0b48c).
const PARTY_ENTRIES = [0xa0, 0x54, 0x02];
const ADVISOR_ENTRIES = [0xb8, 0xe6];
const WALK_ENTRY = 0x02;
// The parting sends the advisor back off the left edge (code+0x0c4ea).
const PARTING_LINE = -50;
const ADVISOR_X = 330;
// A still picture stands at x 158 with its foot at y 174 (code+0x09f60).
const PICTURE_X = 158;
const PICTURE_FOOT = 174;

// Roll for a tip not yet given, up to 50 times, then give the last
// roll whether given or not (code+0x0b7e0).
export const drawTip = (given: Set<number>, random: Random): number => {
  let tip = FIRST_TIP;
  for (let tries = 0; tries < TIP_TRIES; tries++) {
    tip = FIRST_TIP + random(TIPS);
    if (!given.has(tip)) {
      break;
    }
  }
  given.add(tip);
  return tip;
};

const advisorText = (texts: Map<string, string>, id: number): string => {
  const value = texts.get(textKey('BScene.res', id));
  if (value === undefined) {
    throw new Error(`Missing advisor text BScene.res CSTR ${id}`);
  }
  return value.replaceAll(/\s+/g, ' ').trim();
};

// The first box: a welcome, the watched Character's name and one of
// CSTR 0 to 3, then a tip (code+0x0b622).
export const greetingText = (
  name: string,
  texts: Map<string, string>,
  given: Set<number>,
  random: Random
): string => {
  const welcome = advisorText(texts, random(4));
  const greeting = `${GREETINGS[random(4)]}${name}${welcome}`;
  return `${greeting}\n${advisorText(texts, drawTip(given, random))}`;
};

// The second box: one of CSTR 4 to 7, then three times in four a
// proverb and otherwise a tip, and a farewell. The tip is drawn and
// spent either way (code+0x0b6d8, code+0x0b822).
export const partingText = (
  texts: Map<string, string>,
  given: Set<number>,
  random: Random
): string => {
  const prefix = advisorText(texts, 4 + random(4));
  const tip = drawTip(given, random);
  if (random(4) !== 0) {
    const farewell = FAREWELLS[random(4)];
    return `${prefix} ${advisorText(texts, 28 + random(6))} ${farewell}`;
  }
  return `${prefix} ${advisorText(texts, tip)} ${FAREWELLS[random(4)]}`;
};

export interface TalkLines {
  line1: number;
  line2: number;
}

// Met on the Animation Level, the party stops at x 70, or at 160 when
// a figure was already past 70; met through the Campaign Level's "Go
// there", at 70. The advisor stops 100 pixels further on, or at 150
// (code+0x0b4a0, code+0x0af2e).
export const talkLines = (walking: Stage | null): TalkLines => {
  if (!walking) {
    return { line1: 70, line2: 150 };
  }
  const rightmost = Math.max(-1000, ...walking.figures.map(f => f.x));
  const line1 = rightmost >= 70 ? 160 : 70;
  return { line1, line2: line1 + 100 };
};

export interface EncounterTalk {
  // The advisor's roster entry, which owns its figure.
  advisor: number;
  box: { text: string; until: number } | null;
  given: Set<number>;
  name: string;
  // The parting is up: a press closes it, and the talk ends with it.
  parting: boolean;
  // When a still picture's parting opens; null once it has.
  partingAt: number | null;
  picture: { id: number; x: number; y: number } | null;
  random: Random;
  // The party and the advisor, with their lines.
  stage: Stage;
  texts: Map<string, string>;
}

const vblankOf = (ms: number): number => Math.floor(ms / FRAME_MS);

export const startEncounterTalk = (
  a: RosterEntry,
  b: RosterEntry,
  party: Stage,
  lines: TalkLines,
  world: World,
  texts: Map<string, string>,
  given: Set<number>,
  random: Random,
  now: number,
  // Met on the Animation Level: "<A> meets <B>." shows first.
  meets: boolean,
  pictureHeight = 0
): EncounterTalk => {
  const vbl = vblankOf(now);
  const figures: Figure[] = party.figures.map(figure => ({
    ...runEntries(figure, PARTY_ENTRIES),
    next: vbl
  }));
  if (b.figure < 20) {
    const advisor = newFigure(
      { ...world, laggardLine: 0 },
      b.figure,
      0,
      ADVISOR_X,
      166,
      151,
      b.index
    );
    figures.push({
      ...runEntries(advisor, ADVISOR_ENTRIES),
      flipped: true,
      next: vbl
    });
  }
  return {
    advisor: b.index,
    box: meets
      ? { text: `${a.name} meets ${b.name}.`, until: now + BOX_MS }
      : null,
    given,
    name: a.name,
    parting: false,
    partingAt: null,
    picture:
      b.figure >= 20
        ? {
            id: b.figure,
            x: PICTURE_X,
            y: PICTURE_FOOT - pictureHeight
          }
        : null,
    random,
    stage: { ...party, figures, lines },
    texts
  };
};

// A press closes the parting; the greeting stays until the parting
// replaces it (finding:ui-advisor-talk-runs-on-the-advisors-script).
export const pressEncounterTalk = (
  talk: EncounterTalk
): EncounterTalk | null => (talk.parting ? null : talk);

const isParty = (talk: EncounterTalk, figure: Figure): boolean =>
  figure.owner !== talk.advisor;

export const stepEncounterTalk = (
  talk: EncounterTalk,
  world: World,
  now: number
): EncounterTalk | null => {
  const vbl = vblankOf(now);
  const events: TalkEvent[] = [];
  const stage = stepStage(
    talk.stage,
    { ...world, talkEvent: event => events.push(event) },
    vbl
  );
  let next: EncounterTalk = { ...talk, stage };
  const open = (text: string): void => {
    next = { ...next, box: { text, until: now + BOX_MS } };
  };
  const greet = (): void =>
    open(greetingText(talk.name, talk.texts, talk.given, talk.random));
  const part = (): void => {
    open(partingText(talk.texts, talk.given, talk.random));
    next = { ...next, parting: true };
  };
  for (const event of events) {
    if (event === 3) {
      // The party is held where it stands.
      next = withParty(next, figure => ({ ...figure, next: STOPPED }));
    } else if (event === 5) {
      next = withParty(next, figure => ({
        ...runEntries(figure, [WALK_ENTRY]),
        next: vbl
      }));
    } else if (
      event === 6 &&
      talk.picture &&
      next.partingAt === null &&
      !next.parting
    ) {
      greet();
      next = { ...next, partingAt: now + PICTURE_PARTING_MS };
    } else if (event === 12) {
      greet();
    } else if (event === 13) {
      part();
      next = {
        ...next,
        stage: {
          ...next.stage,
          lines: { line1: next.stage.lines!.line1, line2: PARTING_LINE }
        }
      };
    }
  }
  if (next.partingAt !== null && now >= next.partingAt) {
    part();
    next = { ...next, partingAt: null };
  }
  if (next.box && now >= next.box.until) {
    next = { ...next, box: null };
  }
  // The talk is over once its parting has closed.
  return next.parting && !next.box ? null : next;
};

const withParty = (
  talk: EncounterTalk,
  update: (figure: Figure) => Figure
): EncounterTalk => ({
  ...talk,
  stage: {
    ...talk.stage,
    figures: talk.stage.figures.map(figure =>
      isParty(talk, figure) ? update(figure) : figure
    )
  }
});

// The party's figures once the talk is over, walking on.
export const partyAfterTalk = (talk: EncounterTalk): Stage => {
  const { lines: _lines, ...stage } = talk.stage;
  return {
    ...stage,
    figures: stage.figures.filter(figure => isParty(talk, figure))
  };
};

// The box's text keeps the resource's own line breaks, wrapping only a
// line wider than the box (finding:ui-text-font-lord-10). The talk's
// boxes stand at (10, 5), 256 wide (code+0x0b656).
const NOTICE_MAX_WIDTH = 272;
const TALK_BOX_WIDTH = 256;

export const drawEncounterNotice = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  text: string,
  width?: number
): void => {
  const font = style.font.metrics;
  const lines = text
    .split('\n')
    .flatMap(line => wrapText(font, line, (width ?? NOTICE_MAX_WIDTH) - 20));
  const box = drawWindowFrame(ctx, style, {
    height: 16 + lines.length * font.height,
    width: width ?? Math.min(NOTICE_MAX_WIDTH, measureLines(font, lines) + 20),
    x: width ? 10 : 8,
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
  const picture =
    talk.picture === null ? null : assets.strips.get(talk.picture.id);
  if (picture && talk.picture) {
    ctx.drawImage(picture, talk.picture.x, talk.picture.y);
  }
  drawFigures(ctx, assets, talk.stage);
  if (talk.box) {
    drawEncounterNotice(
      ctx,
      assets.window,
      talk.box.text,
      talk.box.text.includes('\n') || talk.parting ? TALK_BOX_WIDTH : undefined
    );
  }
};
