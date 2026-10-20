---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0d894
  - disasm:code+0x0d984
  - disasm:code+0x0d9d8
  - disasm:data+0x1d66
  - disasm:data+0x1d86
  - disasm:data+0x1da0
  - observed:campaign-level-date-line
issue: 123
---

**The Campaign Level's date line reads time first, as "5 p.m. September 23, 1418 s.r.", in colour 3 on a strip of parchment, colour 15, across the bottom 8 rows of the screen.**
The hourly update (code+0x0d894) builds the line from five strings and draws them one after another (code+0x0d9d8, the multi-string helper of finding:ui-message-box-text-colour) at (10, 192) in colour 3: the hour as a number (finding:time-clock-counts-quarter-hours), then " a.m. " or " p.m. " (data+0x1da0, data+0x1da8), the month name with a trailing space (the table at data+0x1d66), the day of the month, and ", 1418 s.r." or ", 1419 s.r." (data+0x1d86, data+0x1d93; finding:time-calendar-september-to-april). The spaces after the time and after the comma are doubled in the strings themselves. Before drawing, it fills 120 by 8 pixels at (10, 192) with colour 15 (code+0x0d984), so each hour's line covers the last one.

In a capture of the Campaign Level the strip runs the whole width of the screen, rows 192 to 199, in #eeeebb, the Campaign Level palette's colour 15, and the line "8 p.m. September 23, 1418 s.r." starts at x 10 in #775555, colour 3. The line is lord/10 (finding:ui-text-font-lord-10) placed with its top at row 192, so the strip shows its capitals and the top of its descenders and cuts off the rest.
