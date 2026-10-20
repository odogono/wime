// Which piece or sound effect the game asks for, and when
// (docs/spec/audio.md). Pieces are numbers in the game's table of
// pieces and effects (finding:sound-score-and-effect-table). Playing
// them is web/src/view/audio.ts's.

// Entries of the table.
export const PIECE = {
  aragorn: 0,
  beware: 1,
  boromir: 2,
  dwarfs: 3,
  fortress: 4,
  frodo: 5,
  gandalf: 6,
  hobRiven: 7,
  longMajorEvil: 8,
  longMajorEvilAgain: 13,
  magicMeditate: 9,
  minasTirith: 10,
  rohanians: 11,
  shortDefeat: 12,
  shortVictory: 14,
  threatening: 15,
  toWarMoria: 17,
  // Disk 1, each a lighter arrangement followed by the full one.
  disk1LongMajorEvil: 20,
  disk1ShortDefeat: 22,
  disk1ShortVictory: 24,
  disk1ToWarMoria: 28,
  title: 26,
  ultVict: 30
} as const;

// The port has memory to spare, so a Disk 1 piece plays in its full
// arrangement, the entry after its lighter one
// (finding:sound-full-arrangements-need-memory).
export const arrangement = (entry: number): number =>
  entry >= PIECE.disk1LongMajorEvil ? entry + 1 : entry;

// The piece for a Place with scenery of its own, by its tile byte
// (finding:sound-place-music). The White Towers (11) and Erech (13)
// have scenery but no piece.
const PLACE_PIECES = new Map<number, number>([
  [10, PIECE.beware],
  [12, PIECE.threatening],
  [14, PIECE.boromir],
  [26, PIECE.dwarfs],
  [28, PIECE.rohanians],
  [29, PIECE.dwarfs],
  [30, PIECE.hobRiven],
  [43, PIECE.longMajorEvil],
  [44, PIECE.beware],
  [45, PIECE.gandalf],
  [46, PIECE.hobRiven],
  [59, PIECE.fortress],
  [60, PIECE.boromir],
  [61, PIECE.longMajorEvilAgain],
  [62, PIECE.hobRiven],
  [77, PIECE.beware],
  [78, PIECE.gandalf],
  [79, PIECE.gandalf],
  [93, PIECE.longMajorEvil],
  [94, PIECE.gandalf],
  [109, PIECE.longMajorEvilAgain],
  [125, PIECE.aragorn],
  [141, PIECE.dwarfs],
  [157, PIECE.dwarfs],
  [174, PIECE.aragorn],
  [188, PIECE.hobRiven],
  [203, PIECE.magicMeditate],
  [252, PIECE.minasTirith],
  [253, PIECE.frodo]
]);

export const placePiece = (tileByte: number): number | null =>
  PLACE_PIECES.get(tileByte) ?? null;

// A Character's theme, by roster index, asked for as the window
// offering to follow them opens (finding:sound-character-themes).
const THEMES = new Map<number, number>([
  [1, PIECE.gandalf],
  [2, PIECE.gandalf],
  [5, PIECE.aragorn],
  [6, PIECE.boromir],
  [7, PIECE.frodo],
  [12, PIECE.dwarfs],
  [17, PIECE.dwarfs],
  [26, PIECE.rohanians],
  [32, PIECE.minasTirith],
  [42, PIECE.fortress],
  [78, PIECE.beware]
]);

export const characterTheme = (rosterIndex: number): number | null =>
  THEMES.get(rosterIndex) ?? null;

// A fight's announcement and end use the Disk 2 copies on the Animation
// Level and the Disk 1 copies elsewhere
// (finding:sound-fight-and-ending-music).
export const fightStartPiece = (onAnimationLevel: boolean): number =>
  onAnimationLevel ? PIECE.toWarMoria : PIECE.disk1ToWarMoria;

export const fightEndPiece = (
  goodWon: boolean,
  onAnimationLevel: boolean
): number =>
  goodWon
    ? onAnimationLevel
      ? PIECE.shortVictory
      : PIECE.disk1ShortVictory
    : onAnimationLevel
      ? PIECE.shortDefeat
      : PIECE.disk1ShortDefeat;

// The sound effects: an instrument slot, the note it plays and how many
// frames it is held (finding:sound-effect-notes). Whoosh and Sword add a roll
// of 4 to their note.
export const EFFECT = {
  bell: 4,
  chime: 5,
  magic: 2,
  sword: 3,
  whoosh: 1
} as const;

export type Effect = (typeof EFFECT)[keyof typeof EFFECT];

// The instrument entry each slot is loaded from.
export const EFFECT_INSTRUMENTS: Record<Effect, number> = {
  [EFFECT.bell]: 32,
  [EFFECT.chime]: 32,
  [EFFECT.magic]: 34,
  [EFFECT.sword]: 35,
  [EFFECT.whoosh]: 33
};

export const effectNote = (
  effect: Effect,
  random: (n: number) => number
): { frames: number; note: number } => {
  switch (effect) {
    case EFFECT.whoosh:
      return { frames: 4, note: 0x6c + random(4) };
    case EFFECT.magic:
      return { frames: 4, note: 0x6c };
    case EFFECT.sword:
      return { frames: 4, note: 0x5c + random(4) };
    case EFFECT.bell:
      return { frames: 4, note: 0x3c };
    case EFFECT.chime:
      return { frames: 2, note: 0x40 };
  }
};
