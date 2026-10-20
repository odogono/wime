# The Council of Elrond

The one-off event at Rivendell that forms the Fellowship under Gandalf
and moves the calendar on. Facts cite their Findings (ADR-0004),
recovered from the Reference Build for #94.

## When it is held

- The Council is held once a game. A flag, part of the saved game,
  says whether it is still to come; it starts set and the Council
  clears it. (finding:ai-council-of-elrond-trigger)
- It is tested when the clock steps onto a whole hour (quarter-hours
  0, 4, 8, ...), after the sweep and before the 8 a.m. daily check,
  and only on the Campaign Level: not while the Animation Level is
  watching an entry. (finding:ai-council-of-elrond-trigger,
  finding:time-daily-check-opens-the-8am-sweep)
- It is held when the Leader of the Ring-bearer's Force stands exactly
  on Rivendell, (1216, 384), and Gandalf, entry 1, stands at
  (1216, 380) or (1216, 384), asleep or awake, alive or dead.
  (finding:ai-council-of-elrond-trigger)
- `provisional`: the original also needs the pointer to be shown
  (data+0x4c72), which it is in play on the Campaign Level; the sim
  does not model it. A follower's position is not kept up to date
  (docs/spec/war-events.md, "Triggers"), so a Gandalf following
  someone is never at Rivendell here; the original reads his stale
  position.

## What it does

All in one step, in this order:

1. The flag is cleared. The day moves on: by 60 days before day 32,
   by 10 days after day 82, and otherwise to day 92. The quarter-hour
   is kept. (finding:time-council-moves-the-calendar-on)
2. For entries 10 down to 5 (Pippin, Merry, Sam, Frodo, Boromir,
   Aragorn), each whose Force's Leader stands on Rivendell is healed to
   its maximum health, then, if its leader is not entry 7 and entry 1's
   strength is not 0, it follows entry 1. Each entry's Force is found
   with the leader changes made so far.
   (finding:forces-council-forms-the-fellowship-under-gandalf)
3. If the Ring-bearer is entry 3 or 4, entry 12 becomes the
   Ring-bearer. No object moves.
   (finding:objects-council-gives-the-ring-to-gimli)
4. If entry 1's strength is not 0, he wakes (state 1), his trigger is
   cleared, and the Ring-bearer, unless he is entry 1, follows him.
   (finding:forces-council-forms-the-fellowship-under-gandalf)
5. Entries 3 and 4 are put to sleep (state 0).
   (finding:objects-council-gives-the-ring-to-gimli)
6. The Nazgûl, entries 79 to 87, are put to sleep and their triggers
   cleared. (finding:ai-council-puts-the-nazgul-to-sleep)
7. Bilbo, entry 154, can be met: his chance becomes 100.
   (finding:forces-advisors-met-once; docs/spec/encounters.md)
8. Every Leader among entries 1 to 150 with a destination is put at
   its destination; the destination is kept, so it arrives on its next
   step. (finding:movement-council-puts-forces-at-their-destinations)
   `provisional`: the original moves followers too, but the sim keeps
   a follower's position empty.

- The Game Speed goes back to Normal.
  (finding:time-council-moves-the-calendar-on)

## The message

(finding:ui-council-of-elrond-message)

- The sim keeps the Council's message, naming the Ring-bearer after
  step 3, until the view closes it. While it waits, game time stands
  still. It is part of the saved game.
- The view shows it on the Campaign Level in a 240 by 130 box with no
  buttons at (40, 20): BScene.res CSTR 46, then CSTR 47 with the
  Ring-bearer's name and " was", then CSTR 48, a line every 10 pixels
  from 20 pixels in and 20 down. It closes by itself after 1200 frames
  (24 seconds) and cannot be dismissed.
