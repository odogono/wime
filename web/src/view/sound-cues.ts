// When the game asks for music and effects, from what the view shows
// (docs/spec/audio.md). Each frame main.ts describes the view as a
// SoundView, and `soundCues` turns the change since the last frame into
// what to play. Pure, so the rules are tested without a browser.
import {
  EFFECT,
  PIECE,
  characterTheme,
  fightEndPiece,
  fightStartPiece,
  placePiece,
  type Effect
} from './music';

export interface SoundView {
  // A key for each message box on show (finding:sound-fight-effects).
  boxes: string[];
  ending: 'none' | 'lost' | 'won' | 'won-last-page';
  fight: 'none' | 'announced' | 'fought' | 'good-won' | 'evil-won' | 'ignored';
  // The Character the follow window offers to follow, while it is open.
  following: number | null;
  // The Level on show, and how many times a Level has been entered, so
  // entering the same Level again counts.
  level: 'animation' | 'campaign' | 'full-map';
  levelEntries: number;
  // The tile byte of the Place the Animation Level's scene was built for,
  // when it has scenery of its own.
  placeTile: number | null;
}

export type SoundCue =
  | { kind: 'stop' }
  | { entry: number; kind: 'ask' }
  | { kind: 'play-asked' }
  | { entry: number; kind: 'play' }
  | { effect: Effect; kind: 'effect' };

export const QUIET: SoundView = {
  boxes: [],
  ending: 'none',
  fight: 'none',
  following: null,
  level: 'animation',
  levelEntries: 0,
  placeTile: null
};

// Figures drawn on frame 9 or 11 play Whoosh or Sword at random, and a
// spell cast plays Magic (finding:sound-fight-effects). The figures are
// compared index by index with the last frame's.
export const figureEffects = (
  previous: readonly { frame: number; spells?: number }[],
  next: readonly { frame: number; spells?: number }[],
  random: (n: number) => number
): Effect[] => {
  const effects: Effect[] = [];
  next.forEach((figure, i) => {
    const before = previous[i];
    if (
      (figure.frame === 9 || figure.frame === 11) &&
      before?.frame !== figure.frame
    ) {
      effects.push(random(2) === 0 ? EFFECT.whoosh : EFFECT.sword);
    }
    if ((figure.spells ?? 0) > (before?.spells ?? 0)) {
      effects.push(EFFECT.magic);
    }
  });
  return effects;
};

export const soundCues = (previous: SoundView, next: SoundView): SoundCue[] => {
  const cues: SoundCue[] = [];
  const onAnimation = next.level === 'animation';

  // A piece never carries from one Level to the next; the Animation
  // Level plays its Place's piece, or one asked for before
  // (finding:sound-music-stops-between-levels, finding:sound-place-music).
  if (next.levelEntries !== previous.levelEntries) {
    cues.push({ kind: 'stop' });
    if (onAnimation) {
      const place = next.placeTile === null ? null : placePiece(next.placeTile);
      if (place !== null) {
        cues.push({ entry: place, kind: 'ask' });
      }
      cues.push({ kind: 'play-asked' });
    }
  }

  // The follow window asks for the Character's theme
  // (finding:sound-character-themes).
  if (next.following !== null && next.following !== previous.following) {
    const theme = characterTheme(next.following);
    if (theme !== null) {
      cues.push({ entry: theme, kind: 'ask' });
    }
  }

  // A fight's announcement and end (finding:sound-fight-and-ending-music).
  if (next.fight !== previous.fight) {
    if (
      next.fight === 'announced' ||
      (next.fight === 'fought' && previous.fight === 'none')
    ) {
      cues.push({ entry: fightStartPiece(onAnimation), kind: 'play' });
    } else if (next.fight === 'good-won' || next.fight === 'evil-won') {
      cues.push({
        entry: fightEndPiece(next.fight === 'good-won', onAnimation),
        kind: 'play'
      });
    }
  }

  // The endings.
  if (next.ending !== previous.ending) {
    if (next.ending === 'lost') {
      cues.push({ entry: PIECE.disk1LongMajorEvil, kind: 'play' });
    } else if (next.ending === 'won') {
      cues.push({ entry: PIECE.disk1ToWarMoria, kind: 'play' });
    } else if (next.ending === 'won-last-page') {
      cues.push({ kind: 'stop' }, { entry: PIECE.ultVict, kind: 'play' });
    }
  }

  // The bell as each message box opens (finding:sound-fight-effects).
  if (next.boxes.some(box => !previous.boxes.includes(box))) {
    cues.push({ effect: EFFECT.bell, kind: 'effect' });
  }
  return cues;
};
