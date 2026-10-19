---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0320c
  - disasm:code+0x031c2
  - disasm:data+0x08c4
  - disasm:code+0x17eec
issue: 45
---

**The game's random numbers come from one generator, seed × 125 mod 2,796,203, but the rolls that size each blow also add in the 50 Hz frame count, so no fight can be replayed exactly from a saved seed.**
random(n) at code+0x0320c steps the seed at data+0x08c4 and returns it mod n. It is used for the chance rolls: evasion, the bonus blows, Encounters. randomBits(k) at code+0x031c2 adds the vertical-blank count (code+0x17eec) before taking the seed mod 2,796,203. It returns the low k bits, and supplies the 0 to 7 of each blow (finding:combat-blow-formula). An outcome therefore depends on the exact frame each round runs on. A reimplementation should match the distribution of results, not single fights (finding:combat-outcomes-are-random).
