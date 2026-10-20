---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x02852
  - disasm:code+0x028dc
  - disasm:code+0x0290a
  - disasm:code+0x0b13e
  - disasm:code+0x1940c
issue: 131
---

**A piece plays through once and is never carried from one Level to another: the main loop frees whatever is playing before it enters the Animation, Campaign or Full Map Level.**
The main loop (finding:ui-animation-level-figures-walk-off) frees the current piece before each Level it runs (code+0x02852, code+0x028dc, code+0x0290a), and the Animation Level frees one that has finished when it starts (code+0x0b13e). A piece is played from its start to its end (code+0x1940c, called with 0 and −1); the two arguments after those, both 1, were not traced, so whether a piece repeats is provisional. The Campaign and Full Map Levels have no music of their own: only a fight's announcement and end play there (finding:sound-fight-and-ending-music).
