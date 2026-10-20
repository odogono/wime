# War Events

How the war moves on without the player: the War Events and when they
are set. Facts cite their Findings (ADR-0004), recovered from the
Reference Build for #57. The reference scenarios are in
`docs/re/war-events-reference.md`. The triggers that wake Forces (#59),
the presentation of the announcements (#60) and the movement tripwires
(#49) have their own sections below.

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

## Triggers

Byte 30 of a roster entry, its trigger, says when the entry is woken
and mobilised. The highest set bit picks the condition.
(finding:ai-trigger-conditions)

- The sweep tests each entry's trigger just before the entry's movement
  step, for entries 1 to 151 whatever their state: asleep, awake,
  following, dead or Evil. Encounter figures, entries 152 and up, are
  never tested. A woken Leader takes its first step in the same tick,
  and a condition that changes during a sweep is seen by the entries
  after it in that sweep, and by the earlier ones in the next.
  (finding:ai-trigger-tested-before-the-move)
- A trigger is tested only when its bits are live in the event mask:
  for a byte up to 0x0f, the byte and the mask share a bit; above
  0x0f, they share a bit in the high nibble.
  (finding:ai-trigger-conditions)
- Bit 0, near the Ring-bearer: the Ring-bearer's Force's Leader is no
  more than 9 pixels away from the entry in x and in y.
  (finding:ai-trigger-distances-are-square)
- Bit 2, near Gandalf: entry 1 or entry 2 is not asleep and is no more
  than 4 pixels away in x and in y, by that Gandalf's own position.
  (finding:ai-trigger-distances-are-square)
- A follower's own position is not kept up to date. The sim keeps it
  as null and, like the original's (0, 0), measures from (0, 0).
- Bits 1 and 3: as soon as the event is set.
- Bits 4 to 7: once the low four bits' number of days has passed since
  the event's day, counted on the low byte of the day, and only while
  the hour is 8 (quarter-hours 32 to 35). An event set by the 8 a.m.
  check is seen by its 0-day entries that morning; one set at any other
  time waits for the next 8 a.m.
  (finding:ai-delayed-triggers-wait-for-hour-8)

## Waking

When an entry's trigger is met (finding:ai-trigger-what-waking-changes):

- An entry with no strength or no health left is not changed, and its
  trigger stays to be tested again every sweep.
- Otherwise a sleeping entry (state 0) wakes (state 1); any other state
  is kept. Allegiance 1 becomes 99, under the player's command; Evil 0
  and every other value are kept.
  (finding:mobilisation-allegiance-byte)
- If the entry's Default Orders queue is not empty, its first Place
  becomes the destination and is taken off the queue. An empty queue
  leaves the destination as it was.
  (finding:ai-default-orders-are-place-queues)
- The trigger is cleared, so it fires once and never takes a second
  Place or overrides a later Order.
- A follower can be woken and given a destination, but does not move
  while it follows. A woken Force appears on the map and takes Orders
  by the existing rules (docs/spec/movement.md).
- The two Gandalfs are entries 1 and 2. Entry 2, waiting at Lórien for
  event 1, wakes at the 8 a.m. check after entry 1 is killed.
  (finding:ai-second-gandalf-wakes-when-the-first-sleeps)

## Tripwires

(finding:mobilisation-tripwires-follow-arrival)

- After a Leader's movement step lands it on a tile origin, and after
  any arrival at its destination, and before the search for a fight,
  two tripwires are tested:
  - An Evil Leader (allegiance 0) on the Isen Ford, (1104, 928), sets
    events 3 and 5. (finding:mobilisation-evil-at-the-fords-of-isen)
  - A non-Evil Leader on any tile origin with x at least 1664 and y at
    least 1008 sets event 7.
    (finding:ai-good-force-near-mordor-starts-the-war)
- Each event is set once with the current day, through the same step
  as the daily check, and nothing is announced. Only Leaders move, so
  followers never set them.
- What follows comes from the rules above. Gondor's event 3 entries
  wake in the same sweep if they come after the Leader in roster
  order, otherwise in the next sweep. The Rohan musters wait for the
  next 8 a.m. Event 7 brings events 3, 4 and 6, with Saruman's
  announcement, at the next 8 a.m. check, and day 169 is then silent.
- Being attacked never mobilises a Force or its Nation.
  (finding:mobilisation-attack-does-not-mobilise)

## Announcements on screen

(finding:ui-war-event-messages)

- Each announcement is shown on the Campaign Level in a one-line box
  with no buttons at the top left: 144 by 24 lo-res pixels for
  Saruman's, 160 by 24 for the Dark Lord's, at (10, 5). It closes by
  itself after 200 frames (4 seconds), and game time runs on while it
  is up.
- Announcements are shown one at a time, oldest first. The view takes
  each from the sim only as it shows it, so one not yet shown survives
  a save, and one already shown is never shown again.
- `provisional`: the original closes the box after 60 frames instead
  at its fastest clock setting. How the Game Speeds map to that setting
  is not traced (docs/spec/time.md), so the box always stays 200 frames.
- `provisional`: the original queues every message box, so an
  announcement and a fight's windows wait for each other. The view
  shows a fight's windows first and keeps an announcement, with the
  time it has left, until they close. Likewise on the Full Map Level,
  where time stands still.
