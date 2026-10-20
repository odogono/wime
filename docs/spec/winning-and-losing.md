# Winning and losing

How the Ring passes from bearer to bearer, and how the game ends.
Facts cite their Findings (ADR-0004), recovered from the Reference
Build for #103. Carrying, taking and dropping objects in general is in
`docs/spec/objects.md`.

## The Ring-bearer

- The game keeps one Ring-bearer, a roster index, apart from the
  objects words; it is part of the saved game. At the start it is
  Frodo, entry 7, who also carries the Ring.
  (finding:objects-ring-starts-with-frodo,
  finding:data-formats-archive-dat-is-roster-dump)
- The Ring is object 0. It is never listed by Put Down or Use, so it
  leaves a Character only by death.
  (finding:objects-provisions-lists)

## How the Ring passes

### Taken from the ground

- A Character who takes the Ring from the ground becomes the
  Ring-bearer. (finding:objects-take-from-the-ground)

### After a fight

- A Ring-bearer killed in a fight leaves the Ring, with everything else
  it carried, at the place of the fight.
  (finding:objects-dead-drop-their-objects)
- At the end of the fight a Ring lying exactly at the fight's place is
  taken from the ground, and goes to one of the winners; with nobody
  to take it, it is lost. (finding:objects-ring-taken-by-last-awake-winner)
  - **Good wins:** the first living Hobbit in the Good rows; with no
    Hobbit, the last-listed awake row, Character or Unit alike. Gollum
    takes it only if he is all that is left of the Good side.
  - **Evil wins:** the last-listed awake Evil row. If the winner was
    an Encounter, not a Force, "The 3rd NAZGUL is sent to the site."
    and the 3rd Nazgûl takes it if awake, where he stands on the
    Campaign Level.
- The new bearer gets the Ring and becomes the Ring-bearer, with
  "<name> now has the RING." ("have" for a Unit). An Evil bearer is
  given Barad-dûr as its destination, leaves its Leader and loses its
  Default Orders, and every other awake Nazgûl loses its Default
  Orders and is sent to Dol Guldur, the Morannon or Minas Morgul, at
  random, with Minas Morgul twice as likely as each of the others.
  The messages share the notice box after the fight's windows close.
  (finding:objects-ring-taken-by-last-awake-winner)

### Worn when wounded

- A Ring-bearer wounded by the enemy's left-over blows in a fight on
  the Animation Level puts the Ring on: "Unable to resist, <name> puts
  on the Ring.". The figure vanishes and the Ring counts as magic
  protection until the fight ends; a surviving bearer then "suddenly
  reappears!". The Ring stays with the bearer.
  (finding:objects-ring-put-on-when-wounded,
  finding:combat-magic-weapons-and-protection)
- It is never put on in a fight that is not shown on the Animation
  Level. (finding:objects-ring-put-on-when-wounded)

### At the Council of Elrond

- If Elrond (entry 3) or Glorfindel (entry 4) is the Ring-bearer when
  the Council is held, Gimli (entry 12) becomes the Ring-bearer. Only
  the Ring-bearer changes; nobody's objects do. See
  `docs/spec/council-of-elrond.md`.
  (finding:objects-council-gives-the-ring-to-gimli)

## Winning

- **The Ring at Mount Doom.** At each whole hour on the Campaign Level
  the sim follows the Ring-bearer's leader chain to the top Leader. If
  that Leader stands exactly on Mount Doom, (1808, 1120), the game is
  won. The Leader's allegiance is not tested, and a Force passing over
  Mount Doom between hours does not win.
  (finding:objects-ring-at-mount-doom-checked-hourly,
  finding:objects-ring-to-mount-doom-wins)
- **Barad-dûr's Garrison destroyed.** At the end of every fight, if no
  Stronghold loss ended the game, the game is won when the Garrison of
  Barad-dûr, entry 148, has no strength left.
  (finding:places-destroying-barad-dur-garrison-wins)

## Losing

- **The Ring at Barad-dûr.** When an Evil Leader whose own objects
  include the Ring lands on a tile origin in its movement step and
  stands on Barad-dûr, (1856, 1120), the game is lost. This is tested
  with the tripwires, after any arrival. No other Place, Orthanc
  included, ends the game.
  (finding:objects-ring-at-barad-dur-loses,
  finding:mobilisation-tripwires-follow-arrival,
  finding:ai-nazgul-carry-captured-ring)
- **Three Strongholds fallen.** At the end of every fight, the game is
  lost when three or more of the Garrisons of Minas Tirith (entry 33),
  Lórien (61), Thranduil's Palace (64), Edoras (67) and the Hornburg
  (68) have no strength left. This is tested before Barad-dûr's
  Garrison, so a fight that does both loses the game.
  (finding:places-stronghold-falls-with-its-garrison,
  finding:places-three-strongholds-lost-loses)

## The end of the game

- Once the game has ended, no tick moves anything, and the ending is
  part of the sim's state.
- Each ending shows three pages of BScene text in message boxes:
  (finding:ui-ending-pages)

  | Ending                   | Pages      | Closing line                             |
  | ------------------------ | ---------- | ---------------------------------------- |
  | the Ring at Barad-dûr    | 49, 51, 52 | "YOU HAVE LOST THE WAR IN MIDDLE EARTH." |
  | three Strongholds fallen | 50, 51, 52 | "YOU HAVE LOST THE WAR IN MIDDLE EARTH." |
  | the Ring at Mount Doom   | 53, 54, 55 | "SO ENDS THE WAR IN MIDDLE EARTH."       |
  | Barad-dûr's Garrison     | 53, 54, 55 | "SO ENDS THE WAR IN MIDDLE EARTH."       |

- The pages are shown over a closing scene: the Animation Level's
  scenery on Mount Doom for a loss, or on Hobbiton for a win, at the
  current hour, with figures drawn on it once. Nothing in it moves.
  (finding:ui-ending-scenes-are-still-pictures)
  - **Lost:** four rows of orcs with shields, two trolls and a balrog
    among them, and a row of nine hooded figures in front.
  - **Won:** the Fellowship in a row: a hobbit, an elf, a hobbit, then,
    facing left, a wizard, a man, two hobbits and a man. The original's
    dwarf, the first of the row, is never drawn, and the port does not
    draw it either.
- The scene shows alone for 300 frames, 6 seconds, or until a key is
  pressed. Then each page is shown in a message box at (30, 10), 240 by 80. The first two pages each stay until a key is pressed or 21
  seconds pass; the last page stays and ignores every other key and
  click. (finding:ui-ending-pages,
  finding:ui-ending-scenes-are-still-pictures)
- The original then quits when X is pressed. The port instead stays on
  the last page; a new game is the view's to offer.
  (finding:ui-ending-pages)
- The view shows the ending once any fight's windows have closed.

## Saving

- The Ring-bearer, the objects words and the placement table are
  saved with the game. The ending is not: the original never saves
  after one. (finding:data-formats-archive-dat-is-roster-dump)
