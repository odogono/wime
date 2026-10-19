---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - resource:AMaps.res#IMAG 32
  - resource:AMaps.res#IMAG 35
  - resource:AMaps.res#IMAG 33
  - resource:AMaps.res#IMAG 34
  - disasm:code+0x0d5d4
  - disasm:code+0x06362
  - disasm:code+0x039a6
issue: 29
---

**The Full Map Level's icon column uses AMaps.res IMAG 32 (eye), 35 (scroll), 33 (magnifying glass) and 34 (hourglass), from top to bottom.**
The bitmaps are respectively 40 by 10, 35 by 16, 31 by 15 and 22 by 14 pixels.
The Full Map Level setup at code+0x0d5d4 sets Level 1 and calls the icon helper
at code+0x06362 with resource IDs 0x20, 0x23, 0x21 and 0x22. The helper passes
each ID to code+0x039a6, which loads an IMAG resource. The icon centres are
(600, 10), (600, 24), (600, 42) and (600, 61) in the 640-column bitmap.
Each decoded image has the matching shape. These are separate resources from
the Campaign Level's smaller icons (`finding:graphics-campaign-icon-imag-ids`).
