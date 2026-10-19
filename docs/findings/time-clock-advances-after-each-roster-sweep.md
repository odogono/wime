---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x0e72c
  - disasm:code+0x0e7a6
  - disasm:code+0x0b304
issue: 5
---

**The main loop moves one roster entry per call, from entry 1 to entry 151, and only after a full sweep, and once a Game Speed counter allows, does the clock advance one quarter-hour.**
The current entry is kept at data+0x56b3. Each call moves on to the next entry until it reaches 151 (code+0x0e72c). After entry 151, the sweep starts again at entry 1 and the clock steps forward one quarter-hour (code+0x0e7a6). The step also waits on a frame counter (data+0x4fec) compared with a limit (data+0x08c2), which is presumably where Game Speed acts; that has not been traced. So one quarter-hour is one step for every awake Force, and this is the game's internal time step. The same function can also be called for just the Character being watched on the Animation Level (code+0x0b304), which gives that Character extra steps.
