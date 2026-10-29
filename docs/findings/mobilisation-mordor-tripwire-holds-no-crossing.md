---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0efd0
  - disasm:data+0x3b00
  - tool:tools/extract-starting-state.ts#readStartingState
  - tool:tools/build-geography.ts#traceCrossings
issue: 329
---

**No Crossing lies in the Mordor tripwire's area, and no non-Evil Leader's Default Orders lead into it.**
The tripwire takes tile origins at or beyond (1664, 1008) (finding:ai-good-force-near-mordor-starts-the-war). The easternmost of the 15 Crossings traced from the roads is the bridge at (1656, 1397), on the tile with origin (1648, 1392), and the Osgiliath bridge is at (1638, 1190). No non-Evil entry starts in the area, and the farthest east a non-Evil route stop lies is Gollum's last stop, the Rammas Forts at (1624, 1184).
