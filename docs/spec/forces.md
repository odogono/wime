# Forces

How Forces meet, join and split. Facts cite their Findings (ADR-0004),
recovered from the Reference Build for #68. The reference scenarios are
in `docs/re/forces-reference.md`. Ordering part of a Force is in
`docs/spec/movement.md`; the followers of a Leader who dies in a fight
are in `docs/spec/combat.md`.

## Meetings

- A meeting is found by the search that finds fights
  (docs/spec/combat.md, "Starting a fight"): the mover has stepped onto
  a tile origin, and the other is a Leader, moving or resting, within
  7 pixels on both axes. When neither of the two is Evil, the match is
  a meeting rather than a fight.
  (finding:forces-meeting-of-non-evil-leaders)
- The two are named A and B. If only one has allegiance above 3, that
  one is A. If both have, A is the one with the higher roster index.
  If neither has, A is the mover.
  (finding:forces-meeting-of-non-evil-leaders)
- The meeting goes on only if A's allegiance is above 3. Otherwise the
  two pass by and the search goes on to the next entry, so two
  unmobilised Leaders never meet. Gollum's allegiance, 40, counts as
  above 3. (finding:forces-meeting-of-non-evil-leaders)
- B's allegiance picks the kind:
  (finding:forces-meeting-of-non-evil-leaders)
  - above 3: A is offered to follow B ("Follow <B>" or "Continue on");
  - 3, an advisor: B invites A to pause and talk ("Go there" or
    "Continue on");
  - 1 or 2: the window offers only "Go there" or "Continue on".
- A meeting stops the sweep at the mover, as a fight does, and the
  clock stands still until it is answered. The next tick carries on
  from the entry after the mover. (finding:ui-meeting-window,
  finding:time-clock-advances-after-each-roster-sweep)
- Offering to follow stops both Leaders (state 2) while the window is
  up. The other kinds leave their states as they were.
  (finding:ui-meeting-window)
- The pending meeting, A, B and its kind, is part of the sim state and
  of the saved game.

## Answering

- "Continue on" is the default. If the player doesn't answer within
  720 frames (about 14 seconds) on the Campaign Level, the window
  answers it by itself. The timeout is the view's.
  (finding:ui-meeting-window)
- Continue on sets both Leaders off again (state 1) and changes
  nothing else. (finding:forces-follow-and-continue-on)
- Follow sets both off again and makes A follow B: A's Leader becomes
  B. A keeps its own position, destination and route, and A's own
  followers still follow A, so they come along through the chain. A
  now moves as part of B's Force. (finding:forces-follow-and-continue-on,
  finding:forces-leader-byte-forms-forces)
- After any Follow, if Gollum's chain of Leaders now ends at a Wizard
  (Animation figure 4), "GOLLUM quietly sneaks away.": he stops
  following and takes that Wizard's position and facing.
  (finding:forces-gollum-sneaks-away-from-a-wizard)
- `provisional`: "Go there" opens the Animation Level, which the sim
  doesn't model yet. The sim offers only Follow and Continue on.

## Leaving a Force

- Only an Order splits a member off (docs/spec/movement.md), apart from
  a Leader's death (docs/spec/combat.md) and Gollum sneaking away.
  (finding:forces-ordering-a-follower-splits-it)

## Left out

- Meeting the Encounter figures, entries 152 to 195, and the
  Encounters on the Animation Level that "Go there" leads to.
- Gollum meeting Frodo, which has its own message, " notices Gollum
  following.". (finding:forces-meeting-of-non-evil-leaders)
- The watch moving from A to B on Follow, which is the view's.
  (finding:forces-follow-and-continue-on)
- The meeting window's text and layout (finding:ui-meeting-window).
