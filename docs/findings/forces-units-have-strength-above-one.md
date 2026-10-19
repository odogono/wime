---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x04d5c
  - disasm:code+0x0f6d2
  - disasm:code+0x0e89e
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**A roster entry is a Unit if its starting strength is more than 1; a Character has strength 1. An entry whose current strength is 0 is dead or destroyed.**
The code tests the starting strength (byte 4) against 1 to tell Units from Characters (code+0x04d5c), and the current strength (byte 6) against 1 when naming an entry (code+0x0f6d2). The main loop skips entries whose current strength is 0 (code+0x0e89e). Among entries 1 to 151, Unit strengths run from 20 (a band of Rangers near Isengard) to 10,000 (the Orcs of the Morannon and Minas Morgul), and the two fields are equal at the start. Some Encounter figures with a strength above 1, such as "trolls" (2) or "wolves" (5), count as small Units by this rule.
