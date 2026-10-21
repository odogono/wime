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
- "Go there" sets both off again as "Continue on" does; the view goes
  down to the Animation Level watching A, for the talk if there is one
  (docs/spec/encounters.md).

## The meeting window

(finding:ui-meeting-window)

- The window opens at the top of the Campaign Level, a box 192 lo-res
  pixels wide at (88, 5), 24 high with one line and 44 with two. Its
  lines are at 8 and 18 within the box, its left button at (16, 30)
  and "Continue on" at (110, 30).
- The first line is "<A> meets <B>.". A Unit is named with its head
  count and takes the plural verb: "1000 infantry meet 800 infantry.".
- The second line, and the left button, depend on the kind:
  - follow: "<B> welcomes <A> to join.", with "Follow <B>". A Unit B
    is capitalised and takes "welcome", a Unit A gets "the", and
    neither has its head count: "Infantry welcome the infantry to
    join.", "Follow infantry";
  - talk: "<B> invites <A> to pause and talk.", with "Go there";
  - plain: no second line, with "Go there".
- The window takes every press while it is up. A press off its
  buttons does nothing. The clock stands still until it is answered,
  and after 720 frames, 14.4 seconds, it answers "Continue on" by
  itself.
- A pending meeting survives a save; the restored game opens its
  window afresh, with the full 720 frames.
- "GOLLUM quietly sneaks away." is shown in a one-line box with no
  buttons at the top left for 60 frames on Very Hasty or 200 otherwise,
  and the clock runs on under it.
  (finding:forces-gollum-sneaks-away-from-a-wizard,
  finding:time-game-speed-clock-limits, finding:ui-war-event-messages)
- `provisional`: the one-line box would leave its buttons, at 30,
  outside its 24 pixels, so it is drawn 44 high like the two-line
  box. The original opens it 24 high with its buttons drawn at 30;
  how that shows on screen needs a capture (#171).
- In the original the deadline counts real frames, and the Full Map
  Level cannot be entered while the window is up, so no time there
  counts against it (finding:ui-message-box-timeouts-by-level,
  finding:ui-message-box-closed-on-leaving-a-level).
- In the original only one box is open at a time: a box raised while
  another is up waits out that box's 200-frame deadline, the game
  standing still, then replaces it
  (finding:ui-message-box-opening-waits-for-the-open-box).
- `provisional`: the port lets the Full Map Level be entered under the
  window, and a War Event announcement waits, its time kept, while the
  window is up (docs/spec/war-events.md, #184).

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
