---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x15b60
  - disasm:code+0x02166
  - disasm:code+0x020c8
issue: 131
---

**The Disk 1 pieces come in a full arrangement and a lighter ".B" one, and the game plays the full one only when it found memory to spare at start-up.**
At start-up the game sets the flag at data+0x4ff1 when free chip memory, less 0x4200, is over 0x5cc60 bytes (code+0x15b60), and then again from a second measure of memory being over 0x55730 bytes (code+0x02166). When a piece is asked for by an entry of 20 or more (finding:sound-score-and-effect-table) and the flag is set, the loader takes the next entry instead (code+0x020c8): Title for Title.B, UltVict for UltVict.B, ShortDefeat for ShortDefeat.B, LongMajorEvil for LongMajorEvil.B. The pairs differ in tempo, notes and instruments (finding:sound-disks-hold-different-sets); ShortVictory and ToWar.Moria name the same file twice. The flag also decides whether the fight sounds are loaded (finding:sound-effects). The Disk 2 pieces have no lighter arrangement.
