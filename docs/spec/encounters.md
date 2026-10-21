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
    (finding:forces-anonymous-encounters-pass-by)
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

(finding:ui-advisors-share-advice)

- The advisor comes to the party; Círdan, Galadriel and Tom Bombadil
  stand as still pictures at the right.
- It speaks three boxes: a greeting with the watched Character's name,
  one tip from BScene.res CSTR 8 to 27 not yet given this session, and
  a parting with a proverb or a further tip and a farewell.
- Talking changes no game state. Which tips have been given is the
  view's, not the sim's, and is not saved.
- `provisional`: the view holds game time during a talk. The arrival
  box lasts four seconds, and each advice box at least four seconds
  (longer for longer text); a click, Space or Enter advances it. The
  advisor's approach and the party's placement are provisional. Once
  all twenty tips are spent, proverbs fill the remaining advice boxes.
  CSTR 8, also a parting prefix, shares the same once-per-session rule.
  (#169)

## Passing by

- A one-line message, "<A> passes <B>.", "<n> <A> pass by <B>." for a
  Unit, or "<A> is challenged by 20 Rohirrim scouts.". Nothing changes.
  (finding:forces-anonymous-encounters-pass-by)
- `provisional`: what the scouts' challenge does on the Campaign Level
  is not known; it does nothing here (#169).
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

- A fight with no Unit on the Good side is played on the Animation
  Level. It is the same fight as in the combat window: the same rows,
  options, rounds and results; the sim's combat code runs unchanged.
- The view places the two sides, walks them to battle lines 25 and 85
  pixels past the rightmost Good figure (100 when a balrog leads the
  Evil side), and shows charges and falls in proportion to the losses.
- When the watched Character is attacked on the Animation Level,
  "<A> is attacked by <B>." shows with no buttons and the fight starts.
  (finding:combat-evil-encounters-attack)
- After the fight the surviving Good figures walk on.
  (finding:combat-character-fights-on-animation-level)
- `provisional`: approach speed, fighting lunges and rotated fall poses
  are view choreography until the fight script entries are specified.
  Rounds without messages stay visible for 800 ms; the combat window's
  orders, messages and result pacing otherwise apply (#169).
