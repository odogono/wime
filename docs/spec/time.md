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
  has no clock wait: a tick lasts one sweep of the roster.
  (`finding:time-game-speed-clock-limits`)
- `provisional`: how long the original's roster sweep takes has not
  been measured. Until it is, Very Hasty runs one tick per 50 Hz frame
  (20 ms, 50 ticks a second), the original's display rate
  (`finding:time-game-speed-clock-limits`), and never more than one
  tick per rendered frame, so it runs at the same pace on any refresh
  rate of 50 Hz or more (#164).
- Generic message boxes with no buttons close after 60 frames
  (1.2 seconds) on Very Hasty and 200 frames (4 seconds) otherwise.
  The duration is set when each box opens. The Council of Elrond has
  its own 1200-frame wait (docs/spec/council-of-elrond.md).
  (`finding:ui-war-event-messages`, `finding:time-game-speed-clock-limits`)
- `provisional`: the speed window's layout and graphics are
  unconfirmed. We draw a plain window under the icon column listing
  the three speeds, marking the current one, with a Pause/Resume line.
  Changing Game Speed changes only how fast ticks arrive, never what
  a tick does (#164).
