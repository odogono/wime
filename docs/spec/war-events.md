# War Events

How the war moves on without the player: the War Events and when they
are set. Facts cite their Findings (ADR-0004), recovered from the
Reference Build for #57. The reference scenarios are in
`docs/re/war-events-reference.md`. The triggers that wake Forces (#59),
the presentation of the announcements (#60) and the movement tripwires
(#49) add their own sections.

## State

- The War Events are a mask of eight bits. Each set bit has an event
  day: the low byte of the day count when it was set. The mask starts
  at 0x05 and every event day at 0. Bits 0 and 2 are never cleared, so
  the Ring-bearer and Gandalf proximity triggers are live all game.
  (finding:ai-war-events-set-once, finding:ai-trigger-conditions)
- An event is set once. Every rule that sets one does nothing if it is
  already set, so an event keeps the day it was first set.
  (finding:ai-war-events-set-once)
- The War Events, their days and the announcements not yet shown are
  part of the saved game.

## The daily check

- The check runs once a day, when the clock steps to quarter-hour 32
  (8 a.m., shown as "9 a.m."), before any Force moves in that
  quarter-hour. It does not run again in that hour, and a game that
  starts or is restored at quarter-hour 32 does not run it until the
  next day. (finding:time-daily-check-opens-the-8am-sweep)
- A fight stops the clock (finding:time-stops-during-a-fight), so a
  fight that interrupts the sweep before 8 a.m. delays the check until
  the sweep finishes and the clock steps. It never runs twice.
- It applies these rules in this order (finding:ai-war-events-set-once):
  1. Event 1: when Gandalf, entry 1, is asleep (state 0) and his
     trigger byte is 0, bits 1 and 2 are set. No day is recorded and
     nothing is announced. In play this happens only after Gandalf
     dies. (finding:ai-second-gandalf-wakes-when-the-first-sleeps)
  2. Event 4: on exactly day 149, or once event 7 is set. Announced.
  3. Event 5: once Théoden, entry 26, has allegiance above 1.
  4. Event 3: once Denethor, entry 32, has allegiance above 1, or once
     event 7 is set.
  5. Event 6: once event 7 is set.
  6. Event 7: on exactly day 169. Announced.
- Event 7 comes last, so when the check sets it, events 3, 4 and 6
  follow at the next day's check. When event 7 is set before 8 a.m.
  by any other means, they follow at that morning's check.
- Days 149 and 169 are tested exactly, not "on or after".
  `provisional`: the original runs the check only on the Campaign
  Level, so an 8 a.m. that passes on the Animation Level loses that
  day's check (finding:ai-war-events-checked-only-on-campaign-level).
  The sim has no Animation Level yet (milestone 6) and runs the check
  every day.

## Setting an event from elsewhere

- Other rules set events through the same set-once step, recording
  the current day: the movement tripwires (#49;
  finding:mobilisation-tripwires-follow-arrival) and, in milestone 7,
  the Palantír. None of them is announced.
  (finding:ai-war-events-set-once)

## Announcements

- Only the daily check's events 4 and 7 are announced, with "Saruman's
  army is on the march!" and "The Dark Lord's armies march forth!".
  (finding:ui-war-event-messages)
- The sim keeps each announcement, with its event and day, until the
  view takes it. Each is taken once. An early event 7 is never
  announced, because day 169 then finds it set; event 4 is announced
  when it follows. One check announces at most one event.
