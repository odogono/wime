---
kind: fact
topic: ui
confidence: provisional
sources:
  - disasm:code+0x0d82a
  - disasm:code+0x0d6fe
  - observed:full-map-at-start
issue: 28
---

**The Full Map dots probably blink with a period of about 1.2 seconds: each phase waits 30 ticks of the counter at data+0x4fee, which is most likely the 50 Hz vertical blank.**
The Full Map Level's loop (code+0x0d6fe) flips a phase flag, redraws the blinking dots in that phase, then waits until the word at data+0x4fee has moved on by 30 (code+0x0d82a), before checking the mouse and keys and going round again. Nothing in the code hunk increments data+0x4fee, so what drives it is not settled; if it counts PAL frames, each phase lasts 0.6 seconds. Screenshots taken about 0.3 seconds apart in FS-UAE alternated between the two phases, which fits but does not pin the rate.
