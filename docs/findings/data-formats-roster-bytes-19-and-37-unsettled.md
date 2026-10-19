---
kind: fact
topic: data-formats
confidence: provisional
sources:
  - disasm:data+0x1de8
  - disasm:code+0x11046
  - disasm:code+0x0f3fa
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 45
supersedes: data-formats-roster-unsettled-fields
---

**Only bytes 19 and 37 of the roster record are still unsettled. Byte 24 holds the magic flags and byte 29 the evasion chance.**
Byte 24 is two flags, bit 0 a magic weapon and bit 1 magic protection (finding:combat-magic-weapons-and-protection). For entries 1 to 151, byte 29 is the chance out of 100 of slipping past an enemy, averaged over a Force (code+0x0f3fa; finding:combat-evasion-chance). For the Encounters it is their chance of being met (finding:forces-encounter-figures-wait-in-areas).

No instruction reads byte 19 directly. It varies between Characters (Gandalf 4, Aragorn 14, Boromir 24, Frodo 5) and among Units of one Nation. It is not a Nation: Lórien's elves and the Iron Hills dwarves share 6. Byte 37 is always 0 and may be padding. The extractor exports both raw.
