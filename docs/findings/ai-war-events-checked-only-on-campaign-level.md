---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e7c6
  - disasm:code+0x0e0da
  - disasm:code+0x0e190
  - disasm:code+0x0cd90
  - disasm:code+0x0221e
  - disasm:code+0x0d5d8
issue: 57
---

**The daily War Event check runs only while the Campaign Level is showing, and the two dated War Events test for their exact day. So a day whose 8 a.m. passes on the Animation Level loses that day's check, and if the day is 149 or 169 the dated War Event never comes from the calendar.**
The tick calls the hourly update only when the mode byte at data+0x5555 is 2 (code+0x0e7c6). Entering the Campaign Level sets it to 2 (code+0x0cd90), the Animation Level 3 (code+0x0221e) and the Full Map Level 1 (code+0x0d5d8). Time stands still on the Full Map Level (finding:time-stops-on-full-map-level), but on the Animation Level the clock still steps, so a quarter-hour 32 can pass there without the check. The check tests `day == 149` for event 4 and `day == 169` for event 7 (code+0x0e0da, code+0x0e190), not "on or after". A skipped day 149 leaves event 4 waiting for event 7, and a skipped day 169 leaves event 7 to the tripwire or the Palantír (finding:ai-war-events-set-once). The other rules test standing conditions, so they simply catch up at the next check.

This is read from the code. The Animation Level case has not been played.
