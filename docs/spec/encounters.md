# Encounters

How Encounters are met, and what talks, passing by and joining do.
Facts cite their Findings (ADR-0004), recovered from the Reference Build
for #81. Meetings between Leaders are in `docs/spec/forces.md`; fights
in `docs/spec/combat.md`.

## Meeting an Encounter

- Entries 152 to 195 are Encounter figures. They never move: each waits
  in a rectangle and can be met from a set day with a set chance.
  (finding:forces-encounter-figures-wait-in-areas)
- The search runs as part of the roster sweep. On the Campaign Level it
  runs when the mover steps onto a tile origin; on the Animation Level
  on every step. Evil movers never meet Encounters. The chance is out
  of 50 on the Campaign Level and 100 elsewhere.
  (finding:forces-encounters-by-allegiance)
- Small figures meet only the Fellowship's Forces, and folk only at
  settlements and on roads.
  (finding:forces-encounter-figures-wait-in-areas,
  finding:forces-folk-met-only-in-settlements)
- The figure's allegiance picks what happens:
  (finding:forces-encounters-by-allegiance)
  - 0: an attack (`docs/spec/combat.md`), after the evasion roll.
    (finding:combat-evil-encounters-attack)
  - 1: the two pass by. Met only on the Animation Level by the watched
    Character, except the Rohirrim scouts.
    (finding:forces-pass-by-walks-past-on-animation-level)
  - 3, an advisor: an invitation to talk.
- An advisor is used up when met, whatever the answer: its chance drops
  from 100 to 0. Radagast instead returns 10 to 15 days later. Bilbo
  can be met only after the Council of Elrond.
  (finding:forces-advisors-met-once)
- Evil Encounters are never used up: after every fight their health is
  restored. (finding:combat-evil-encounters-attack)
- No Encounter figure joins a Force or moves.

## The talk window

(finding:ui-encounter-talk-window)

- On the Campaign Level the window reads "<A> meets <B>." and "<B>
  invites <A> to pause and talk.", with "Go there" and "Continue on",
  in the meeting window's box (`docs/spec/forces.md`). It stops the
  clock and holds both still; "Continue on" is the default after 720
  frames.
- "Go there" watches A and goes down to the Animation Level for the
  talk. "Continue on" sets both moving again.
- When the watched Character meets an advisor on the Animation Level,
  a one-line "<A> meets <B>." box opens and the talk starts at once.

## The talk

(finding:ui-advisor-talk-has-two-boxes,
finding:ui-advisor-talk-follows-the-advisors-script)

- The scene is set again, the party walking in from the left. Met on
  the Animation Level, it walks to x 70, or to 160 if a figure had
  already reached 70; after "Go there", to 70. A walking advisor
  enters mirrored from the right and walks to 100 pixels past the
  party's line, or to 150 after "Go there". Círdan, Galadriel and Tom
  Bombadil stand as still pictures at x 158, their feet at y 174.
- Met on the Animation Level, "<A> meets <B>." shows first and stays
  until the first box replaces it.
- The advisor speaks two boxes at (10, 5), 256 wide. The first is a
  greeting with the watched Character's name and one of BScene.res
  CSTR 0 to 3, then a tip, one of CSTR 8 to 27. The second is one of
  CSTR 4 to 7, then three times in four a proverb (CSTR 28 to 33) and
  otherwise a tip, and a farewell.
- A tip is rerolled up to 50 times to find one not yet given this
  session, then given anyway, so tips repeat once all 20 are spent.
  The second box draws and spends a tip even when it shows a proverb.
  Which tips have been given is the view's, not the sim's, and is not
  saved.
- A walking advisor's script paces the talk: once at its line it
  holds the party, opens the first box, gestures a while, opens the
  second, sets the party walking on and walks off the left edge. A
  still picture's first box opens when the party reaches its line and
  the second 600 frames later; the party is not held, standing 750 to
  1,499 frames before walking on.
- The first box can't be pressed away. The second closes on a press,
  Space or Enter, or after 1,500 frames, and the talk ends with it.
  The clock stands until then.
- Talking changes no game state.

## Passing by

- A one-line message, "<A> passes <B>.", "<n> <A> pass by <B>." for a
  Unit, or "<A> is challenged by 20 Rohirrim scouts.". Nothing
  changes, and the figure's chance is not spent; the scouts' challenge
  is a message like any other.
  (finding:forces-pass-by-walks-past-on-animation-level)
- When the watched Character passes by on the Animation Level, the
  scene is set again: the party walks on while the figures passed by
  enter mirrored from the right and walk past it, off the left edge.
  The clock stands for 420 frames.
  (finding:forces-pass-by-walks-past-on-animation-level)
- A pass-by message is a box without buttons, shown like any other
  message box (docs/spec/time.md, "Message boxes"): one at a time in
  the order raised, a later box waiting out its 200-frame deadline (60
  on Very Hasty) with the game standing still, and up to 1,220 frames
  on the Campaign Level or 1,500 on the Animation Level
  (finding:ui-message-box-opening-waits-for-the-open-box,
  finding:ui-message-box-timeouts-by-level). Pass-bys raised during a
  talk wait for it to end.

## Joining

- Recruiting a Leader is the follow choice of a meeting
  (`docs/spec/forces.md`): "<B> welcomes <A> to join.", "Follow <B>".
  Leaders not yet mobilised can't be recruited.
  (finding:forces-joining-by-meeting)

## Fights on the Animation Level

(finding:combat-character-fights-on-animation-level,
finding:combat-where-a-fight-is-fought)

- A fight is played on the Animation Level when no Good row holds a
  Unit and Elrond leads none. It is the same fight as in the combat
  window: the same options, rounds and results; the sim's combat code
  runs unchanged.
- Its rows are listed again around the watched Character, which comes
  first with its followers. Good Leaders come from entries 1 to 77, and
  each side holds at most 9 rows, or 7 against a balrog, the Evil side
  one more. (finding:combat-animation-level-lists-the-fight-again,
  finding:combat-rows-capped-by-level-and-enemy)
- The figures act the fight out through fixed entries of their
  scripts. Each side walks at its figures' own pace to its battle line,
  25 and 85 pixels past the rightmost Good figure (100 when a balrog
  leads the Evil side), and holds its stance; the first round follows
  once both have arrived.
  (finding:combat-animation-level-figures-follow-fight-entries)
- Each round a row that Charges swings three times and one that
  Engages twice, in place. A wounded individual's side recoils, and the
  first row on the other side that Charges or Engages lunges.
- A loss fells losses × 10 / the row's starting strength of its
  figures, or the losses themselves for a row that began 10 strong or
  less; a killed Character's row falls entire. The fallen play their
  fall and lie where they fell. At the end the winners stand, and a
  beaten Evil side falls.
  (finding:combat-animation-level-figures-follow-fight-entries)
- Only messages pace it: 300 frames before the first round, at least
  180 for each casualty message and 300 after the result. A round
  without a message takes no time.
  (finding:combat-animation-level-round-pacing)
- When the watched Character is attacked on the Animation Level,
  "<A> is attacked by <B>." shows with no buttons and the fight starts.
  (finding:combat-evil-encounters-attack)
- After the fight the surviving Good figures walk on.
  (finding:combat-character-fights-on-animation-level)
