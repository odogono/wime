---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ec88
issue: 10
---

**A step whose fraction accumulator reaches two whole pixels still moves only one pixel when that pixel lands the entry exactly on a tile origin.**
After moving the first pixel at code+0x0ec92, the code at code+0x0ecd6 moves the second pixel only if the new position is not aligned in both axes, so steering and the arrival test at the next tile origin are never skipped over. Stamina, though, is charged for the step as usual, so the fastest Forces (class 5, exactly 2 px a step on terrain 100) lose every other pixel's worth of pace when travelling tile to tile along the axes.
