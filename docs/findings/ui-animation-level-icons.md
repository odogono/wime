---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x09e02
  - disasm:code+0x06362
  - resource:AMaps.res#IMAG 21
  - observed:animation-level-opening
issue: 80
---

**The Animation Level shows three icons in a column at the top right: the eye, the map and the provisions sack.**
On entering, code+0x09e02 places AMaps.res IMAG 21 (the eye), IMAG 23 (the map) and IMAG 25 (a figure with a sack) centred on (300, 10), (300, 25) and (300, 42), as buttons 0xf0, 0xf6 and 0xf9 (code+0x06362). The map icon, button 0xf6, goes up to the Campaign Level. The capture of the opening scene shows the same column.
