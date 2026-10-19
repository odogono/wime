---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0ed3c
  - disasm:code+0x0f044
  - disasm:code+0x0f05c
  - disasm:code+0x0f0b0
  - disasm:code+0x0f228
  - disasm:code+0x0f376
  - disasm:code+0x0e892
  - observed:combat-calembel-ignored
  - observed:combat-faramir-go-there
issue: 45
---

**A fight starts when a moving Leader steps onto a tile origin within 7 pixels of an awake Leader, and exactly one of the two is Evil.**
The check is made for the Leader that has just moved, after its step (code+0x0ed3c). Off a tile origin the Campaign Level checks nothing, and the other Levels check only Encounters (code+0x0f044). The other Leader must be awake, moving or resting, must have no Leader of its own, and must be within 7 pixels on both axes (code+0x0f0b0). An Evil mover looks only at roster entries 1 to 78. Any other mover looks at every entry up to 195, so it also meets Encounters (code+0x0f05c).

The pair is ordered so that an Evil party comes second (code+0x0f228). If the second party is Evil it is a fight (code+0x0f376); two non-Evil Leaders have a friendly meeting instead. The Evil entries are 79 to 151 and an Evil mover never looks at them, so Evil never fights Evil. An unmobilised Leader, allegiance 1, counts as non-Evil, so it can be attacked. A Leader with no destination is never moved (code+0x0e892), so it never starts a fight, although others can walk into it.

In play, 500 orcs set down exactly on Éomer's tile origin stepped off it without a fight. A Unit of Gondor infantry stepping one pixel onto its tile origin, where the orcs stood, started one at once.
