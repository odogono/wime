---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0d240
  - disasm:code+0x0d284
  - disasm:code+0x0e7c6
  - disasm:code+0x0e7f6
  - observed:campaign-flash-normal
  - observed:campaign-flash-hasty
  - observed:campaign-flash-very-hasty
  - observed:campaign-flash-scrolling
issue: 200
---

**The player's Forces flash because every redraw of the Campaign Level flips them between shown and hidden. On Normal that is every 64 frames, 1.28 seconds shown and 1.28 hidden; on Hasty every quarter-hour, 30 frames; on Very Hasty once an hour, about 16 frames; and while the map scrolls, at every redraw, about every 4 frames.**
The Campaign Level redraw (code+0x0d1d0) toggles a phase byte, data+0x4f40, each time it runs (code+0x0d240). While the phase is 0 it skips the icon of any leader whose allegiance is above 2 (code+0x0d284), the mobilised Forces under the player's command (finding:mobilisation-allegiance-byte). Other icons are drawn at every redraw and stay steady.

The redraw runs at each quarter-hour step unless the Game Speed is Very Hasty, when it runs only at the hour's step (code+0x0e7c6). While the clock waits for its next step it also runs whenever the frame counter, cleared at each step, is a multiple of 64 (code+0x0e7f6). On Normal, whose step waits 256 frames (finding:time-game-speed-clock-limits), that gives a redraw at frames 0, 64, 128 and 192 of every quarter-hour. On Hasty the counter never reaches 64 before the 30-frame step. The worry that the multiple-of-64 test could pass on several passes in one frame, flipping the phase twice, did not show: a redraw takes one to three frames, so the counter has moved on before the next pass. Scrolling the map redraws it too, so the icons flicker fast while it scrolls.

In FS-UAE, with a breakpoint on the toggle, the frame counter read 1 to 3 at the step and 0x41, 0x81 and 0xC1 after it on Normal; on Hasty successive toggles were 28 to 32 frames apart, and on Very Hasty 14 to 17 frames apart at each hour (docs/re/campaign-flash-reference.md).
