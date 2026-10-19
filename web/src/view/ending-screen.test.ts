import { describe, expect, test } from 'bun:test';

import { textKey } from './assets';
import { endingScreen, turnEndingPage } from './ending-screen';

const texts = new Map(
  [50, 51, 52, 53, 54, 55].map(id => [
    textKey('BScene.res', id),
    `page ${id}\nsecond line\n`
  ])
);

describe('the ending screen', () => {
  test('three fallen Strongholds show CSTR 50, 51 and 52', () => {
    const screen = endingScreen('lost-strongholds', texts);
    expect(screen.pages).toEqual([
      ['page 50', 'second line'],
      ['page 51', 'second line'],
      ['page 52', 'second line']
    ]);
  });

  test('the Barad-dûr Garrison destroyed shows CSTR 53 to 55', () => {
    expect(endingScreen('won-barad-dur', texts).pages[0]).toEqual([
      'page 53',
      'second line'
    ]);
  });

  test('a press turns the page, and the last page stays', () => {
    let screen = endingScreen('won-barad-dur', texts);
    screen = turnEndingPage(turnEndingPage(screen));
    expect(screen.page).toBe(2);
    expect(turnEndingPage(screen)).toBe(screen);
  });
});
