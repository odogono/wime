---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x0e7b0
  - disasm:code+0x0d8f4
  - disasm:code+0x0dde0
  - disasm:data+0x3e64
issue: 5
---

**The game clock is a day count and a quarter-hour count, 96 quarter-hours a day. The game starts on day 0 at quarter-hour 64, the start of hour 16, which the date display shows as "5 p.m.".**
The day count is the word at data+0x3e64 and the quarter-hour count the word at data+0x3e66. Each step adds one quarter-hour, and after quarter-hour 95 the count returns to 0 and the day count goes up by one (code+0x0e7b0). The display takes the hour as the quarter-hour count divided by 4. It shows hours 0 to 10 as 1 to 11 a.m., hour 11 as 12 p.m., hours 12 to 22 as 1 to 11 p.m. and hour 23 as 12 a.m., so it always names the hour after the one under way (code+0x0d8f4). Once a day, at hour 8, the game runs its daily checks, such as the copy protection and the war events (code+0x0dde0). Day 0 is 23 September 1418 (finding:time-calendar-september-to-april), which matches the manual (finding:time-quest-starts-23-september).
