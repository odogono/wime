# Campaign flash Reference runs

The `observed:campaign-flash-…` Reference runs in the Findings, played in FS-UAE 3.2 on the Reference Build (issue #200). Each times the Campaign Level's blink toggle in emulated frames.

## Setting up

1. Boot as in [`fs-uae.md`](fs-uae.md), press space through the title, the Ring verse and Gandalf's letter, and press U for the Campaign Level. The data hunk loaded at 0x390E8 and the code hunk at 0x1D0C8.
2. Keep the pointer inside the map, away from its edges: at an edge the map scrolls, the clock stands still, and the redraws come every few frames.
3. Set the speed through the clock limit, data+0x08c2 (0x399AA), as in [`game-speed-reference.md`](game-speed-reference.md).
4. Set a breakpoint on the store to `blinkPhase`, code+0x0d24c (`f 2a314`), and queue per hit `S /tmp/bl-N 3e0d4 4` (the frame counter and the vblank count, data+0x4fec) and `S /tmp/bq-N 3cf4c 4` (day and quarter-hour), then `g`.

## Reference runs

| Reference run               | Set-up                              | Outcome                                                                                                                                                         |
| --------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaign-flash-normal`     | Day 0 from 4 p.m., Normal, 30 hits  | Four toggles a quarter-hour, at frame counter 1 to 3 (the step's redraw), 0x41, 0x81 and 0xC1: one every 64 frames by the vblank count. Never two in one frame. |
| `campaign-flash-hasty`      | Day 0 from 6 p.m., Hasty, 16 hits   | One toggle at each quarter-hour step, 28 to 32 frames apart.                                                                                                    |
| `campaign-flash-very-hasty` | Day 0 to day 1, Very Hasty, 12 hits | One toggle at each hour's step, 14 to 17 frames apart.                                                                                                          |
| `campaign-flash-scrolling`  | Pointer resting on the map edge     | The clock stood still and the toggle came every 3 to 5 frames.                                                                                                  |
