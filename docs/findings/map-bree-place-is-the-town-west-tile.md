---
kind: fact
topic: map
confidence: confirmed
sources:
  - disasm:code+0x0e342
  - disasm:data+0x3e76
  - resource:AMaps.res#MMAP 1
issue: 200
---

**Bree's town graphic spans two small-town tiles, columns 49 and 50 of row 24, and Bree's Place position, (784, 384), is the western one. The game uses the position as it is: only a point on that tile is Bree, and a point on the eastern tile is "a small town".**
Finding:map-positions-are-campaign-pixels read Bree's position as one tile west of its town graphic. The map grid shows otherwise: tile 94 at (49, 24) holds the town's gate and its western house, and tile 46 at (50, 24) the rest of its houses; both are small-town tiles (finding:places-kinds-matched-by-map-tile). The town is drawn off-centre across them, which is why a position marker on the tile corner looked west of it.

The game names the Place at a point with code+0x0e342. It clears the low four bits of x and y and compares the result exactly with each named Place's position (data+0x3e76), so a named Place covers exactly one tile, the one its position names. Only then does it try the generic kinds by the tile underneath. A Force on (50, 24) is therefore at "a small town", not at Bree, and one on (49, 24) is at Bree. No code adjusts Bree's position.
