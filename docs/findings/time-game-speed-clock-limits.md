---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x07fd8
  - disasm:code+0x08380
  - disasm:code+0x0e750
  - disasm:code+0x17eec
issue: 68
---

**Game Speed sets how many frames a quarter-hour waits for: 256 on Normal, 30 on Hasty and none on Very Hasty, at 50 frames a second. A quarter-hour therefore lasts 5.12 seconds on Normal, 0.6 seconds on Hasty, and only as long as one sweep of the roster on Very Hasty.**
The Game Speed window's buttons are 0xb5 "Very Hasty", 0xb6 "Hasty" and 0xb7 "Normal" (code+0x07fd8). They set the clock limit at data+0x08c2 to 0, 30 and 256 (code+0x08380). The frame counter that the tick compares with the limit goes up in the vertical-blank interrupt alongside the vblank count (code+0x17eec). The clock steps after a sweep once the counter reaches the limit, or 256 (code+0x0e750; finding:time-clock-advances-after-each-roster-sweep). The Council of Elrond sets the limit back to 256 (code+0x0daa4). A message box with no buttons closes after 60 frames instead of 200 when the limit is 0 (finding:ui-war-event-messages).
