---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0eee6
  - disasm:code+0x0e566
  - disasm:code+0x0da6c
  - disasm:data+0x3b00
  - tool:tools/extract-starting-state.ts#readStartingState
  - tool:tools/build-geography.ts#traceCrossings
issue: 329
---

**Frodo's Default Orders end at Rivendell, across the Bruinen, and the Crossing he would take there is the Ford of Bruinen, the tile where the Nazgûl sleep: on it he wakes them, a tile to the north he does not.**
Frodo's last leg runs from Bree, (784, 384), to Rivendell, (1216, 384), on the river's east bank (finding:ai-default-orders-are-place-queues). The straight way meets the Bruinen at (1200, 384), one tile north of the Ford of Bruinen, Place 22 at (1200, 400); the ford's Crossing is on that tile. A Nazgûl ending its tour there sleeps on (1200, 400) until the Ring-bearer's Force comes within 9 pixels on both axes (finding:forces-nazgul-hide-at-ford-of-bruinen, finding:ai-trigger-distances-are-square). From (1200, 384) the Nazgûl are 16 pixels away and stay asleep. On the ford tile they wake. Elrond, asleep at (1208, 392) and also waiting for the Ring-bearer, is within 9 pixels of both tiles, so he wakes either way.

So under Classic movement whether Frodo wakes the sleeping Nazgûl depends on where along the bank he wades (finding:movement-rivers-crossed-by-the-straight-step). A Force routed over the Crossing always passes the Nazgûl. Frodo's arrival at Rivendell also holds the Council of Elrond while Gandalf is still there (finding:ai-council-of-elrond-trigger), so the time spent on the bank moves the Council.
