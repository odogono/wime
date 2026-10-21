# Game Speed reference scenarios

The `observed:game-speed-…` scenarios in the Findings, played in FS-UAE 3.2 on the Reference Build (issue #164). Each times the clock's quarter-hour steps in emulated frames, so the host's speed doesn't enter it.

## Setting up

1. Boot as in [the combat reference](combat-reference.md), press space through the title and the Ring verse, and reach the Campaign Level. The data hunk loaded at 0x390E8 and the code hunk at 0x1D0C8.
2. Keep the pointer inside the map: resting it on an edge scrolls the Campaign Level, and the clock never steps while it scrolls.
3. Set the speed by writing the clock limit, data+0x08c2 (0x399AA): 0x0100 Normal, 0x001E Hasty, 0 Very Hasty. This is what the window's buttons write (code+0x08380).
4. In the debugger, set a breakpoint on the clock step, code+0x0e7a6 (`f 2b86e`), and queue a dump and a `g` for every step wanted: `S /tmp/bv-N 3e0d6 2` reads the vblank count, data+0x4fee, and `S /tmp/bk-N 3cf4c 4` the day and quarter-hour. Commands queued while the game runs fire at the next stop, so no debugger chord is needed. `f 2b86e` again clears the breakpoint.

The emulator stands still at each stop, and the vblank count with it, so the differences between dumps are the frames each quarter-hour took.

## Scenarios

| Scenario                | Set-up                                                                         | Outcome                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game-speed-normal`     | Day 0 from 7 p.m., Normal, data hunk dumped every 3 s instead of a breakpoint. | Two quarter-hours in 513 frames; between steps the sweep waited at entry 151 with the frame counter climbing to 256.                                                                                                                                        |
| `game-speed-hasty`      | Day 4, Hasty, 40 steps timed by the breakpoint.                                | Every quarter-hour took 30 frames.                                                                                                                                                                                                                          |
| `game-speed-very-hasty` | Day 4, 3 a.m. to day 6, 2 a.m., Very Hasty, 150 steps timed by the breakpoint. | A quarter-hour took 2 or 3 frames, and the one after each hour's step 8 to 10: 4.03 frames on average, 16 an hour. Dumps every 2 to 3 s on days 0 to 2 and 8 to 13, leaving out the time boxes held the clock, gave 3.8 to 5 and 4.2 frames a quarter-hour. |
| `game-speed-window`     | Day 0, Normal, T pressed on the Campaign Level.                                | The window of finding:ui-game-speed-window. Unanswered, the clock stayed at 8 p.m. while the frame counter rose past 256 to about 700, and then the box closed with its default, Normal, pressed.                                                           |
