---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0dd04
issue: 94
---

**At the end of the Council of Elrond, every entry from 1 to 150 with a destination is put at its destination.**
For entries 1 to 150, when the destination's x is not 0, the position is set to the destination (code+0x0dd04). The destination itself is kept, so each such Leader arrives on its next step and takes the next stop of its Default Orders, if any (finding:movement-arrival-pops-next-route-stop). This stands in for the days the Council skips (finding:time-council-moves-the-calendar-on). The test does not look at state, so sleeping and dead entries with a destination are moved too; Gandalf, waiting at (1216, 380) with Rivendell as his destination, ends at (1216, 384).
