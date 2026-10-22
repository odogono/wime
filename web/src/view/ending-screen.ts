import type { Ending } from '../sim/index';
import { textKey } from './assets';
import { FRAME_MS } from './tick-driver';
import { drawWindowFrame, windowText, type WindowStyle } from './window-frame';

// How the game ends on screen (docs/spec/winning-and-losing.md,
// finding:ui-ending-pages, finding:ui-ending-scenes-are-still-pictures):
// the still scene alone for 300 frames, then three pages of BScene text
// in a message box over it. The losing endings show CSTR 49 for the
// Ring at Barad-dûr or 50 for three fallen Strongholds, then the common
// 51 and 52; both winning endings show 53 to 55. The scene and the
// first two pages each give way to a press or after their time; the
// last page stays. A pure state machine over real time in milliseconds.

export const ENDING_PAGES: Record<Ending, number[]> = {
  'lost-barad-dur': [49, 51, 52],
  'lost-strongholds': [50, 51, 52],
  'won-barad-dur': [53, 54, 55],
  'won-mount-doom': [53, 54, 55]
};

export const SCENE_ALONE_MS = 300 * FRAME_MS;
export const PAGE_MS = 1050 * FRAME_MS;

// The box the pages are shown in, and their text's place in it
// (code+0x02cea, code+0x02d1e).
export const ENDING_BOX = { height: 80, width: 240, x: 30, y: 10 };
const TEXT_LEFT = 20;
const TEXT_TOP = 10;
const LINE_HEIGHT = 10;

export interface EndingScreen {
  // -1 while the scene is shown alone.
  page: number;
  pages: string[][];
  // When the scene or page gives way by itself; null on the last page.
  until: number | null;
}

export const endingScreen = (
  ending: Ending,
  texts: Map<string, string>,
  now: number
): EndingScreen => ({
  page: -1,
  pages: ENDING_PAGES[ending].map(id =>
    (texts.get(textKey('BScene.res', id)) ?? '').replace(/\n+$/, '').split('\n')
  ),
  until: now + SCENE_ALONE_MS
});

// A press turns to the next page; the last page stays.
export const turnEndingPage = (
  screen: EndingScreen,
  now: number
): EndingScreen => {
  const last = screen.pages.length - 1;
  if (screen.page >= last) {
    return screen;
  }
  const page = screen.page + 1;
  return { ...screen, page, until: page < last ? now + PAGE_MS : null };
};

// The original quits to AmigaDOS when X is pressed on the last page
// (finding:ui-ending-pages); the port leaves for the title menu instead.
export const endingLeftBy = (screen: EndingScreen, key: string): boolean =>
  screen.page === screen.pages.length - 1 && key.toLowerCase() === 'x';

export const stepEndingScreen = (
  screen: EndingScreen,
  now: number
): EndingScreen =>
  screen.until !== null && now >= screen.until
    ? turnEndingPage(screen, now)
    : screen;

export const drawEndingScreen = (
  ctx: CanvasRenderingContext2D,
  style: WindowStyle,
  scene: CanvasImageSource,
  screen: EndingScreen
): void => {
  ctx.drawImage(scene, 0, 0);
  const lines = screen.pages[screen.page];
  if (!lines) {
    return;
  }
  const box = drawWindowFrame(ctx, style, ENDING_BOX);
  lines.forEach((line, i) => {
    windowText(
      ctx,
      style,
      line,
      box.x + TEXT_LEFT,
      box.y + TEXT_TOP + i * LINE_HEIGHT
    );
  });
};
