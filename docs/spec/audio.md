# Audio

What the game plays and when: its pieces of music, its four sound
effects, and switching sound off and on. Facts cite their Findings
(ADR-0004), recovered from the Reference Build for #131. How the files
are laid out is in the Findings of #130; how the browser plays them is
#132's ADR.

## The pieces and sounds

- The game names every piece and effect in one table of 36 entries,
  each a path on Disk 1 ("A:") or Disk 2 ("B:"). A piece is asked for
  by entry number; the request waits until the game loads it, which
  frees the piece before. (finding:sound-score-and-effect-table)
- The Disk 1 pieces, Title, UltVict, ShortDefeat, LongMajorEvil,
  ShortVictory and ToWar.Moria, have a full and a lighter ".B"
  arrangement. The full one plays only when the game found memory to
  spare at start-up. The port has memory to spare, so it always plays
  the full arrangement. (finding:sound-full-arrangements-need-memory)
- A piece plays through once from start to end and never repeats.
  (finding:sound-a-piece-plays-once)
- Moving to another Level stops the piece playing: no piece carries
  from one Level to the next. (finding:sound-music-stops-between-levels)

## When music plays

- Start-up: Title plays under the boot sequence. Unless a key skipped
  part of it, the first Animation Level waits for Title to end; see
  `docs/spec/boot-sequence.md`. (finding:sound-fight-and-ending-music,
  finding:sound-title-music-in-the-boot-sequence)
- The Animation Level: entering it on a Place with scenery of its own
  plays that Place's piece; other places are silent.
  (finding:sound-place-music)

  | Places                                                                                                        | Piece         |
  | ------------------------------------------------------------------------------------------------------------- | ------------- |
  | Hobbiton, Tuckborough, Rivendell                                                                              | Hob.Riven     |
  | Michel Delving, Waymeet, Anfalas, Bree, the Grey Havens                                                       | Gandalf       |
  | Buckland, Thranduil's Palace, Derndingle                                                                      | Aragorn       |
  | Dale, Forlond, Ethring, Calembel, Linhir, Pelargir                                                            | Boromir       |
  | Mount Gram, Mt. Gundabad, Goblin Town, Durthang, Annuminas, Belegost, Ost-in-Edhil, Hollin Gate, Dimrill Dale | Dwarfs        |
  | Edoras, the Hornburg                                                                                          | Rohanians     |
  | Dol Amroth                                                                                                    | Fortress      |
  | Minas Tirith, the Rammas forts                                                                                | MinasTirith.B |
  | Lórien                                                                                                        | MagicMeditate |
  | Tom Bombadil's house                                                                                          | Frodo         |
  | Weathertop, Deadman's Dike, Minas Morgul, Cirith Ungol, Carach Angren                                         | Beware        |
  | Isengard                                                                                                      | Threatening   |
  | Barad-dûr, Mount Doom, the Morannon, Dol Guldur                                                               | LongMajorEvil |

- Meeting a Character: the window offering to follow GANDALF, ARAGORN,
  BOROMIR, FRODO, GIMLI, DAIN, THEODEN, DENETHOR, IMRAHIL or GOLLUM
  asks for that Character's theme: Gandalf, Aragorn, Boromir, Frodo,
  Dwarfs for Gimli and Dáin, Rohanians, MinasTirith.B, Fortress and
  Beware. It plays when the Animation Level next starts.
  (finding:sound-character-themes)
- A fight: ToWar.Moria plays when the fight announcement opens, or on
  the Animation Level as soon as the watched Character is in a fight.
  When it ends, ShortVictory plays if Good still has strength and
  ShortDefeat if not. An ignored fight has no music at its end. These
  are the only pieces on the Campaign Level; the Full Map Level has
  none. (finding:sound-fight-and-ending-music)
- The end of the game: losing plays LongMajorEvil over the losing
  scene; winning plays ToWar.Moria over the winning scene, then UltVict
  with the last box. (finding:sound-fight-and-ending-music)

## Sound effects

- ReverbBells, a bell, rings as every message box opens.
  (finding:sound-fight-effects)
- On the Animation Level, a figure turning to frame 9 or 11 of its set
  plays Whoosh or Sword at random, and a figure's script casting a spell
  plays Magic, as the spell's flash, a figure of set 18, sets off
  (docs/spec/animation-level.md). (finding:sound-fight-effects,
  finding:graphics-spell-flash)
- The original's Sword never sounds: its Disk 2 copy cannot play the
  note asked for. The port departs from this and plays Disk 1's sword,
  so every blow is heard. (finding:sound-disk-2-sword-is-silent)
- ReverbBells also rings as a click lands on any button or icon, and
  when the magnifying glass finds Forces near its spot; a box the click
  opens rings it again. N and Y ring nothing of their own.
  (finding:sound-reverb-bells-ring-on-a-press)

## Switching sound off

- Sound starts on. Q, in either case, switches it off and on;
  switching it off stops the piece playing, and with it off nothing
  plays. (finding:sound-q-toggles-sound)
- The setting is the player's, not the game's: it is not saved with
  the game. (finding:sound-q-toggles-sound)
