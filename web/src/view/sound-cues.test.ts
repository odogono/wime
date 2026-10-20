import { describe, expect, test } from 'bun:test';

import { EFFECT, PIECE } from './music';
import { QUIET, figureEffects, soundCues, type SoundView } from './sound-cues';

const view = (changes: Partial<SoundView>): SoundView => ({
  ...QUIET,
  ...changes
});

describe('sound cues', () => {
  // finding:sound-music-stops-between-levels, finding:sound-place-music
  test('entering a Level stops the piece; the Animation Level plays its Place', () => {
    const hobbiton = view({ levelEntries: 1, placeTile: 62 });
    expect(soundCues(QUIET, hobbiton)).toEqual([
      { kind: 'stop' },
      { entry: PIECE.hobRiven, kind: 'ask' },
      { kind: 'play-asked' }
    ]);
    expect(
      soundCues(hobbiton, view({ level: 'campaign', levelEntries: 2 }))
    ).toEqual([{ kind: 'stop' }]);
    expect(soundCues(hobbiton, hobbiton)).toEqual([]);
  });

  // finding:sound-character-themes
  test('the follow window asks for the theme of the Character met', () => {
    expect(soundCues(QUIET, view({ following: 5 }))).toEqual([
      { entry: PIECE.aragorn, kind: 'ask' }
    ]);
    expect(soundCues(QUIET, view({ following: 8 }))).toEqual([]);
  });

  // finding:sound-fight-and-ending-music
  test('a fight plays at its announcement and its end, not when ignored', () => {
    const campaign = view({ level: 'campaign' });
    const announced = { ...campaign, fight: 'announced' as const };
    expect(soundCues(campaign, announced)).toEqual([
      { entry: PIECE.disk1ToWarMoria, kind: 'play' }
    ]);
    expect(soundCues(announced, { ...announced, fight: 'ignored' })).toEqual(
      []
    );
    const fought = view({ fight: 'fought' });
    expect(soundCues(QUIET, fought)).toEqual([
      { entry: PIECE.toWarMoria, kind: 'play' }
    ]);
    expect(soundCues(fought, view({ fight: 'good-won' }))).toEqual([
      { entry: PIECE.shortVictory, kind: 'play' }
    ]);
  });

  test('the endings play their pieces', () => {
    expect(soundCues(QUIET, view({ ending: 'lost' }))).toEqual([
      { entry: PIECE.disk1LongMajorEvil, kind: 'play' }
    ]);
    expect(
      soundCues(view({ ending: 'won' }), view({ ending: 'won-last-page' }))
    ).toEqual([{ kind: 'stop' }, { entry: PIECE.ultVict, kind: 'play' }]);
  });

  // finding:sound-fight-effects
  test('a bell rings as a message box opens', () => {
    expect(soundCues(QUIET, view({ boxes: ['info:FRODO'] }))).toEqual([
      { effect: EFFECT.bell, kind: 'effect' }
    ]);
    expect(
      soundCues(view({ boxes: ['info:FRODO'] }), view({ boxes: [] }))
    ).toEqual([]);
  });
});

// finding:sound-fight-effects
const figure = (frame: number, spells = 0) => ({ frame, spells });

describe('fight effects', () => {
  test('a figure turning to frame 9 or 11 plays Whoosh or Sword', () => {
    expect(
      figureEffects([figure(8), figure(1)], [figure(9), figure(1)], () => 0)
    ).toEqual([EFFECT.whoosh]);
    expect(figureEffects([figure(10)], [figure(11)], () => 1)).toEqual([
      EFFECT.sword
    ]);
    // Still on the frame: nothing more.
    expect(figureEffects([figure(9)], [figure(9)], () => 0)).toEqual([]);
  });

  test('a spell plays Magic', () => {
    expect(figureEffects([figure(2)], [figure(2, 1)], () => 0)).toEqual([
      EFFECT.magic
    ]);
  });
});
