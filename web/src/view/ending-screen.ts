import type { Ending } from '../sim/index';
import { textKey } from './assets';

// The texts the game ends with (docs/spec/combat.md, "Endings"): the
// losing ending for three fallen Strongholds shows BScene CSTR 50, then
// the common closing texts 51 and 52; the winning ending shows 53 to 55,
// as the Ring reaching Mount Doom does
// (finding:places-stronghold-falls-with-its-garrison,
// finding:places-destroying-barad-dur-garrison-wins). Each page waits
// for a press; the last stays. The original's scenes and music behind
// them wait for the Animation Level.

export const ENDING_PAGES: Record<Ending, number[]> = {
  'lost-strongholds': [50, 51, 52],
  'won-barad-dur': [53, 54, 55]
};

export interface EndingScreen {
  page: number;
  pages: string[][];
}

export const endingScreen = (
  ending: Ending,
  texts: Map<string, string>
): EndingScreen => ({
  page: 0,
  pages: ENDING_PAGES[ending].map(id =>
    (texts.get(textKey('BScene.res', id)) ?? '').replace(/\n+$/, '').split('\n')
  )
});

// A press turns to the next page; the last page stays.
export const turnEndingPage = (screen: EndingScreen): EndingScreen =>
  screen.page < screen.pages.length - 1
    ? { ...screen, page: screen.page + 1 }
    : screen;

const LINE_HEIGHT = 10;
const LEFT = 6;

export const drawEndingScreen = (
  ctx: CanvasRenderingContext2D,
  screen: EndingScreen
): void => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  const lines = screen.pages[screen.page] ?? [];
  const top = Math.max(4, Math.floor((200 - lines.length * LINE_HEIGHT) / 2));
  lines.forEach((line, i) => {
    ctx.fillText(line, LEFT, top + i * LINE_HEIGHT, 320 - LEFT * 2);
  });
};
