---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x0daa4
  - disasm:code+0x0daae
  - disasm:code+0x0dd04
issue: 94
---

**The Council of Elrond moves the calendar on: by 60 days before day 32, by 10 days after day 82, and otherwise to day 92, 24 December. It also sets the clock limit back to Normal.**
The day count (data+0x3e64) gets 60 added when it is below 32, 10 added when it is above 82, and is set to 92 otherwise (code+0x0daae). The quarter-hour is not changed. The message says "For nearly two months the fellowship rests and recuperates." (finding:ui-council-of-elrond-message). The clock limit at data+0x08c2 is set to 256, the Normal Game Speed's value (code+0x0daa4; finding:time-game-speed-clock-limits).

The days pass in one jump: nothing moves or is checked on the skipped days. Instead, every Force with a destination is put at it (finding:movement-council-puts-forces-at-their-destinations).
