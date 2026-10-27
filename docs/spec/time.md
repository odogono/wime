# Time

How game time passes: the clock, the calendar, the tick and Game Speed.
Facts cite their Findings (ADR-0004); the time facts were recovered by
the starting-state RE (#5, #21).

## The clock

- The clock is a day count and a quarter-hour count, 96 quarter-hours
  a day. Each step adds one quarter-hour; after quarter-hour 95 the
  count returns to 0 and the day count goes up by one. The game starts
  on day 0 at quarter-hour 64.
  (`finding:time-clock-counts-quarter-hours`)
- One tick of the simulation is one quarter-hour: in the original the
  clock steps after each full sweep of roster entries 1 to 151, when
  a Game Speed counter allows.
  (`finding:time-clock-advances-after-each-roster-sweep`) Our sim does
  not reproduce the sweep order (ADR-0002); a tick is just the
  quarter-hour step.
- Once a day, as the clock steps to quarter-hour 32 (hour 8), the
  daily checks run before anything moves, among them the War Events
  (docs/spec/war-events.md).
  (`finding:time-daily-check-opens-the-8am-sweep`)

## The calendar

- Day 0 is 23 September 1418 s.r., Frodo's birthday, the day the quest
  begins. (`finding:time-quest-starts-23-september`,
  `finding:time-calendar-september-to-april`)
- The calendar knows eight months, September to April. A table gives
  the day count each month starts on: -22, 8, 38, 68, 100, 130, 160, 190. Every month has 30 days except December, which has 32. The
  year shows as 1418 up to day 99 and 1419 from day 100, 1 January.
  There is no month after April, so dates from day 220 on show as
  April days past the 30th; we keep that behaviour.
  (`finding:time-calendar-september-to-april`)

## Displaying the time

- The display hour is the quarter-hour count divided by 4, and it
  names the hour after the one under way: hours 0-10 show as 1-11
  a.m., 11 as 12 p.m., 12-22 as 1-11 p.m., 23 as 12 a.m. So the start,
  quarter-hour 64 (hour 16), shows as "5 p.m.".
  (`finding:time-clock-counts-quarter-hours`)
- The Campaign Level shows the date as one line at (10, 192), in the
  8-pixel strip below the 320 by 192 map view: time first, in the form
  `5 p.m.  September 23,  1418 s.r.`, with the spaces after the time
  and the comma doubled. The line is colour 3 on a strip of colour 15,
  the parchment, across the screen's full width.
  (`finding:ui-date-line`)

## Game Speed and pausing

Game Speed and pausing live in the view layer; the simulation has no
knowledge of them (ADR-0002).

- There are three Game Speeds: Normal, Hasty and Very Hasty. The
  hourglass icon (or the T key) opens a window listing the speeds;
  clicking one sets it and closes the window. The setting controls
  the rate of all actions in the game.
  (`finding:time-game-speed-settings`, `finding:ui-key-bindings`)
- The P key pauses. (`finding:ui-key-bindings`) The original shows
  "The Game is Paused." (`finding:executable-amiga-hunk-file`)
- A quarter-hour waits for 256 frames on Normal and 30 on Hasty, at
  50 frames a second: 5.12 seconds and 0.6 seconds per tick. Very Hasty
  has no clock wait: a tick lasts one sweep of the roster, which takes
  4 frames on average on an A500, so a tick every 80 ms and an hour in
  about 0.32 seconds. (`finding:time-game-speed-clock-limits`,
  `finding:time-game-speed-rates-observed`)
- Message boxes: only one is open at a time. Opening one sets its
  deadline: 60 frames (1.2 seconds) on Very Hasty and 200 frames
  (4 seconds) otherwise for a box with no buttons, 720 frames for a box
  with buttons on the Campaign Level and 1,020 on the Animation Level.
  A box raised before the open box's deadline waits for it, and the
  game stands still meanwhile: no tick, and the Animation Level's
  figures hold. Then the open box closes, its default pressed if it has
  buttons, and the new one opens, so boxes show in the order raised.
  Answering the open box ends the wait early.
  (finding:ui-message-box-opening-waits-for-the-open-box,
  `finding:ui-war-event-messages`, `finding:time-game-speed-clock-limits`)
- A box with buttons is answered by its default at its deadline. A box
  without buttons stays until a later box replaces it, or 1,220 frames
  on the Campaign Level (1,080 on Very Hasty) and 1,500 on the
  Animation Level (1,360). These are frames of real time, less time in
  the in-game menu. On the Full Map Level no box times out
  (finding:ui-message-box-timeouts-by-level).
- Leaving a Level closes its box, pressing its default, and the Full
  Map Level cannot be entered while a box with buttons is up
  (finding:ui-message-box-closed-on-leaving-a-level). Accepted for
  1.0: the port also closes the box on leaving the Animation Level,
  which the Finding does not cover. It matches the other Levels, and
  pressing the default loses no state.
- A press off a box's buttons does nothing. A click on a Force or a
  Place on the Campaign Level closes the box, pressing its default, and
  opens that Force's or Place's window in its place; the combat window
  and the Council of Elrond also close the open box. The Council has
  its own 1200-frame wait (docs/spec/council-of-elrond.md). N presses
  a box's default and Y its other button
  (finding:ui-message-box-presses-off-the-buttons).
- A pressed icon or button flashes before the press acts: six times,
  4 frames apart, swapping each of its colours c for c XOR 8, while the
  game, keys included, stands still. The magnifying glass flashes the
  icon of the Force it found four times. (finding:ui-press-flash)
- The hourglass, or T, first closes the open box, pressing its default,
  then opens a box at (184, 5), 90 by 68, headed "Rate of Time
  Passage", with framed buttons for Very Hasty, Hasty and Normal. The
  current speed's button is red and is the box's default. The clock
  holds while it is up; a button sets its speed and closes it, N or Y
  and the timeout of a box with buttons press the default, and a press
  off the buttons does nothing. Changing Game Speed changes only how
  fast ticks arrive, never what a tick does.
  (`finding:ui-game-speed-window`)
