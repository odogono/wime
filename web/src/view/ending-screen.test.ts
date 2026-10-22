import { describe, expect, test } from 'bun:test';

import { textKey } from './assets';
import {
  PAGE_MS,
  SCENE_ALONE_MS,
  endingLeftBy,
  endingScreen,
  stepEndingScreen,
  turnEndingPage
} from './ending-screen';

const texts = new Map(
  [49, 50, 51, 52, 53, 54, 55].map(id => [
    textKey('BScene.res', id),
    `page ${id}\nsecond line\n`
  ])
);

const firstLines = (ending: Parameters<typeof endingScreen>[0]): string[] =>
  endingScreen(ending, texts, 0).pages.map(page => page[0]!);

describe('the ending screen', () => {
  test('three fallen Strongholds show CSTR 50, 51 and 52', () => {
    expect(endingScreen('lost-strongholds', texts, 0).pages).toEqual([
      ['page 50', 'second line'],
      ['page 51', 'second line'],
      ['page 52', 'second line']
    ]);
  });

  test('the Ring at Barad-dûr shows CSTR 49, then 51 and 52', () => {
    expect(firstLines('lost-barad-dur')).toEqual([
      'page 49',
      'page 51',
      'page 52'
    ]);
  });

  test('both wins show CSTR 53 to 55', () => {
    for (const ending of ['won-barad-dur', 'won-mount-doom'] as const) {
      expect(firstLines(ending)).toEqual(['page 53', 'page 54', 'page 55']);
    }
  });

  test('the scene shows alone for 300 frames, then each page for 1050', () => {
    // finding:ui-ending-pages, finding:ui-ending-scenes-are-still-pictures
    let screen = endingScreen('won-mount-doom', texts, 1000);
    expect(screen.page).toBe(-1);
    expect(stepEndingScreen(screen, 1000 + SCENE_ALONE_MS - 1)).toBe(screen);
    screen = stepEndingScreen(screen, 1000 + SCENE_ALONE_MS);
    expect(screen.page).toBe(0);
    screen = stepEndingScreen(screen, 1000 + SCENE_ALONE_MS + PAGE_MS);
    expect(screen.page).toBe(1);
    screen = stepEndingScreen(screen, 1000 + SCENE_ALONE_MS + 2 * PAGE_MS);
    expect(screen).toMatchObject({ page: 2, until: null });
    expect(stepEndingScreen(screen, 1e9)).toBe(screen);
  });

  test('a press turns the page at once, and the last page stays', () => {
    let screen = endingScreen('won-barad-dur', texts, 0);
    screen = turnEndingPage(screen, 5);
    expect(screen).toMatchObject({ page: 0, until: 5 + PAGE_MS });
    screen = turnEndingPage(turnEndingPage(screen, 6), 7);
    expect(screen.page).toBe(2);
    expect(turnEndingPage(screen, 8)).toBe(screen);
  });

  test('only X on the last page leaves the ending', () => {
    let screen = endingScreen('lost-barad-dur', texts, 0);
    for (let page = -1; page < 2; page++) {
      expect(endingLeftBy(screen, 'x')).toBe(false);
      screen = turnEndingPage(screen, 0);
    }
    expect(screen.page).toBe(2);
    expect(endingLeftBy(screen, 'x')).toBe(true);
    expect(endingLeftBy(screen, 'X')).toBe(true);
    expect(endingLeftBy(screen, ' ')).toBe(false);
    expect(endingLeftBy(screen, 'Escape')).toBe(false);
  });
});
