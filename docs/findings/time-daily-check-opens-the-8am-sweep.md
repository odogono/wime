---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x0e7a6
  - disasm:code+0x0e7c6
  - disasm:code+0x0d8f4
  - disasm:code+0x0dde0
  - observed:war-events-day-149
  - observed:war-events-day-148
issue: 57
---

**The daily checks, the War Events among them, run once a day, the moment the clock steps to quarter-hour 32 (8 a.m.), before any roster entry moves in that quarter-hour.**
When the clock steps forward after entry 151 (finding:time-clock-advances-after-each-roster-sweep), it resets the sweep to entry 1 and, if the new quarter-hour is on the hour, calls the hourly update (code+0x0e7c6). The hourly update redraws the date and, when the hour is 8, runs the copy-protection check and then the War Events (code+0x0dde0). The hour is the quarter-hour divided by 4, and the update runs only when the quarter-hour is a multiple of 4. So the check runs exactly once a day, at quarter-hour 32. It does not run again at 8:15, 8:30 or 8:45. Anything it sets is seen by every entry in the sweep that follows (finding:ai-trigger-tested-before-the-move).

The date line adds one to the hour before printing it (code+0x0d926). The 8 a.m. check therefore happens as the line changes to "9 a.m.", just as the start, quarter-hour 64, reads "5 p.m." (finding:time-clock-counts-quarter-hours).

In play, with a breakpoint on the hourly update, it stopped at quarter-hour 32 with the sweep at entry 1. Event 4 was already set on day 149, and entries 57, 88 and 89 then woke in roster order in that same quarter-hour. On day 148 the check ran and set nothing.
