import { describe, expect, test } from 'bun:test';

import {
  EFFECT,
  PIECE,
  arrangement,
  characterTheme,
  effectNote,
  fightEndPiece,
  fightStartPiece,
  placePiece
} from './music';

// The highest roll.
const roll = (n: number) => n - 1;

describe('what plays when', () => {
  // finding:sound-full-arrangements-need-memory
  test('a Disk 1 piece plays in its full arrangement', () => {
    expect(arrangement(PIECE.title)).toBe(27);
    expect(arrangement(PIECE.ultVict)).toBe(31);
    expect(arrangement(PIECE.frodo)).toBe(PIECE.frodo);
  });

  // finding:sound-place-music
  test('a Place with scenery of its own has its piece', () => {
    expect(placePiece(62)).toBe(PIECE.hobRiven); // Hobbiton
    expect(placePiece(94)).toBe(PIECE.gandalf); // Bree
    expect(placePiece(252)).toBe(PIECE.minasTirith);
    expect(placePiece(11)).toBeNull(); // the White Towers
    expect(placePiece(1)).toBeNull();
  });

  // finding:sound-character-themes
  test('Characters met have their themes', () => {
    expect(characterTheme(1)).toBe(PIECE.gandalf);
    expect(characterTheme(17)).toBe(PIECE.dwarfs); // DAIN
    expect(characterTheme(78)).toBe(PIECE.beware); // GOLLUM
    expect(characterTheme(8)).toBeNull(); // SAM
  });

  // finding:sound-fight-and-ending-music
  test('a fight plays from the disk of the Level it is on', () => {
    expect(fightStartPiece(true)).toBe(PIECE.toWarMoria);
    expect(fightStartPiece(false)).toBe(PIECE.disk1ToWarMoria);
    expect(fightEndPiece(true, true)).toBe(PIECE.shortVictory);
    expect(fightEndPiece(false, false)).toBe(PIECE.disk1ShortDefeat);
  });

  // finding:sound-effect-notes
  test('each effect is one note held for a few frames', () => {
    expect(effectNote(EFFECT.whoosh, roll)).toEqual({ frames: 4, note: 0x6f });
    expect(effectNote(EFFECT.bell, roll)).toEqual({ frames: 4, note: 0x3c });
    expect(effectNote(EFFECT.chime, roll)).toEqual({ frames: 2, note: 0x40 });
  });
});
