---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x178ca
  - disasm:code+0x1940c
  - disasm:code+0x196f8
issue: 170
---

**Every piece of music plays through once and stops: the game never repeats one.**
The score player is started only through code+0x178ca, which always passes the piece's start 0, its end −1 and a play count of 1 (code+0x178d4). The player keeps the count at offset 0x0a of its state (code+0x19464). When a piece reaches its end, a negative count would start it again from the beginning for ever, and any other is counted down, starting the piece again until it reaches 0 (code+0x196f8 to code+0x19730). With 1 the count reaches 0 at the first end, and the piece stops. This settles the open point of finding:sound-music-stops-between-levels.
