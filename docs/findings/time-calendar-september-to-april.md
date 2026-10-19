---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:data+0x4230
  - disasm:data+0x1d66
  - disasm:code+0x0d8b0
issue: 5
---

**The calendar knows eight months, September 1418 to April 1419 in Shire Reckoning, and turns the day count into a date with a table of the day each month starts on.**
The table at data+0x4230 gives the first day of each month as -22, 8, 38, 68, 100, 130, 160 and 190, for September to April (the month names are at data+0x1d66). The date display finds the last month that starts on or before the day count (code+0x0d8b0). So day 0 is 23 September and day 8 is 1 October. Every month has 30 days except December, which has 32, perhaps for the Shire's two Yule days. The year shows as "1418 s.r." up to day 99 and "1419 s.r." from day 100, 1 January. There is no entry after April, so dates from day 220 on would show as April days past the 30th.
