---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x07df2
  - disasm:code+0x07e18
  - disasm:code+0x07e3c
  - observed:galadriels-mirror
issue: 124
---

**Galadriel's Mirror is headed "In the still surface of the pool, you see forces moving..." in colour 8, blue, 20 hi-res pixels into the box, while its rows start 10 in.**
The Mirror opens its box with the heading as the box's own text and colour 8 (code+0x07df2, code+0x07e18). The message box routine draws that text at (20, 8) on the Full Map Level (finding:ui-message-box-text-colour). The Good rows are then drawn at x 10 and the Evil rows at x 412 (code+0x07e3c; finding:ui-galadriels-mirror-lists-forces-on-the-move). In the Full Map Level palette colour 8 is a light blue. A capture shows the heading in blue, starting further right than "FRODO is going to GREEN HILLS." below it.
