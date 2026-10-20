import type { Ending } from '../sim/index';
import type { FigureSetAsset } from './assets';

// The still picture behind the end pages (docs/spec/winning-and-losing.md,
// finding:ui-ending-scenes-are-still-pictures). The Animation Level's
// scene is built on Mount Doom or Hobbiton, then figure frames are
// copied onto it once by their top left corner, with no hot spot and no
// script: nothing in it moves.

export interface EndingFigure {
  colour: number;
  flipped: boolean;
  frame: number;
  frml: number;
  x: number;
  y: number;
}

// Where each ending's scene is built (code+0x0299e, code+0x02e96).
export const ENDING_VIEW: Record<'lost' | 'won', { x: number; y: number }> = {
  lost: { x: 1808, y: 1120 },
  won: { x: 640, y: 368 }
};

export const isWon = (ending: Ending): boolean => ending.startsWith('won');

const ORC = 6;
const HOODED = 8;
const TROLL = 9;
const BALROG = 12;

// The losing picture (code+0x02a28): four rows of orcs from y 106, one
// every 30 pixels from x -20, each at a random one of frames 10 to 13
// and jittered; two trolls and a balrog among them; then a front row of
// nine hooded figures from x 10, 33 apart.
const lostFigures = (random: (n: number) => number): EndingFigure[] => {
  const figures: EndingFigure[] = [];
  for (let row = 106; row <= 130; row += 8) {
    for (let column = -20; column < 320; column += 30) {
      const frame = 13 - random(4);
      const flipped = random(2) === 1;
      const y = row + random(7);
      const x = column + random(25);
      figures.push({ colour: 0, flipped, frame, frml: ORC, x, y });
    }
    if (row === 114) {
      figures.push(
        { colour: 0, flipped: false, frame: 11, frml: TROLL, x: 18, y: 90 },
        { colour: 0, flipped: true, frame: 1, frml: BALROG, x: 240, y: 83 }
      );
    }
    if (row === 122) {
      figures.push({
        colour: 0,
        flipped: false,
        frame: 8,
        frml: TROLL,
        x: 2,
        y: 95
      });
    }
  }
  for (let column = 10; column <= 280; column += 33) {
    const flipped = random(2) === 1;
    const y = 140 + random(10);
    const x = column + random(15);
    figures.push({ colour: 1, flipped, frame: 13, frml: HOODED, x, y });
  }
  return figures;
};

// The winning picture's nine, left to right: the figure set, its frame
// and how far it stands above the line (data+0x093a, data+0x0943,
// data+0x094c). The five on the right face left. The dwarf's frame 17
// is past the end of FRML 3's 17 frames, an entry of width 0, so the
// original draws no dwarf; neither does the port.
const FELLOWSHIP = [
  { colour: 4, frame: 17, frml: 3, rise: 0 },
  { colour: 12, frame: 16, frml: 0, rise: 0 },
  { colour: 2, frame: 15, frml: 1, rise: 10 },
  { colour: 5, frame: 16, frml: 0, rise: 0 },
  { colour: 6, frame: 15, frml: 4, rise: 26 },
  { colour: 14, frame: 16, frml: 2, rise: 12 },
  { colour: 3, frame: 16, frml: 0, rise: 0 },
  { colour: 11, frame: 16, frml: 0, rise: 0 },
  { colour: 24, frame: 16, frml: 2, rise: 10 }
];

// Colours from finding:graphics-figure-colour-selectors.
// Drawn from the right, x 245 down to 45, 25 apart (code+0x02f3a).
const wonFigures = (random: (n: number) => number): EndingFigure[] => {
  const figures: EndingFigure[] = [];
  for (let k = FELLOWSHIP.length - 1; k >= 0; k--) {
    const { colour, frame, frml, rise } = FELLOWSHIP[k]!;
    const y = 140 + random(10) - rise;
    const x = 45 + k * 25 + random(7);
    figures.push({ colour, flipped: k > 3, frame, frml, x, y });
  }
  return figures;
};

// The figures in drawing order; the rolls are the view's, as the
// original's were its own.
export const endingFigures = (
  ending: Ending,
  random: (n: number) => number
): EndingFigure[] => (isWon(ending) ? wonFigures(random) : lostFigures(random));

export const drawEndingFigures = (
  ctx: CanvasRenderingContext2D,
  sets: Map<number, FigureSetAsset>,
  figures: EndingFigure[]
): void => {
  for (const figure of figures) {
    const set = sets.get(figure.frml);
    const frame = set?.frames[figure.frame];
    if (!set || !frame) {
      continue;
    }
    ctx.save();
    if (figure.flipped) {
      ctx.translate(figure.x + frame.width, figure.y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(figure.x, figure.y);
    }
    ctx.drawImage(
      set.sheet,
      frame.x,
      set.colour_rows[figure.colour] ?? 0,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height
    );
    ctx.restore();
  }
};
