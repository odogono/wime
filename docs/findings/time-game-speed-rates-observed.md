---
kind: fact
topic: time
confidence: observed
sources:
  - observed:game-speed-normal
  - observed:game-speed-hasty
  - observed:game-speed-very-hasty
  - disasm:code+0x0e7c6
issue: 164
---

**In play a quarter-hour takes 256 frames on Normal, 30 on Hasty and about 4 on Very Hasty, at 50 frames a second: 5.12 s, 0.6 s and 0.08 s, or an hour in about 16 frames on Very Hasty.**
Normal and Hasty wait out their clock limits exactly (finding:time-game-speed-clock-limits), since the roster sweep they wait on is much shorter. Very Hasty has no limit, so a quarter-hour lasts as long as the sweep: 2 or 3 frames on an A500, and 8 to 10 for the sweep that follows each hour's step. On Very Hasty the clock step redraws the Campaign Level every fourth quarter-hour (code+0x0e7c6), which accounts for the longer one. Over 150 steps between days 4 and 6 the average was 4.03 frames, and samples from days 0 to 13 agreed. The sweep's time depends on the processor, so a faster Amiga would run Very Hasty faster.
