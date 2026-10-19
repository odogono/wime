---
kind: fact
topic: map
confidence: confirmed
sources:
  - disasm:code+0x0e306
  - disasm:code+0x0d52c
  - tool:tools/extract-starting-state.ts#renderOverlay
issue: 5
---

**Every position in the game's tables is a pixel position on the 2,560 by 1,584 Campaign Level map, so the tile under a position is (x ÷ 16, y ÷ 16).**
The function that reads the terrain under a point (code+0x0e306) takes byte `(y & 0xfff0) × 10 + x ÷ 16` of the map grid, which is row y ÷ 16, column x ÷ 16 of the 160-tile-wide grid (finding:data-formats-campaign-map-grid). Places and starting positions are mostly multiples of 16, so they name the top-left corner of a tile. The Full Map Level draws each Force at (x ÷ 4, y ÷ 8) (code+0x0d52c). Drawn over the rendered map, the Places fall on their town, castle and citadel tiles. Bree is the exception: its Place position is one tile west of the town graphic.
