---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:data+0x4b88
  - disasm:code+0x02202
  - resource:ATitle.res#IMAG 72
issue: 145
---

**The boot sequence has one palette of 32 colours, the RGB4 words at data+0x4b88, loaded once at start-up before the first picture is drawn.**
The start-up routine loads it at code+0x02202 through the palette routine code+0x15d38, for the 5-plane screen (depth from data+0x4ac1), and nothing changes it until the Animation Level's palette replaces it (finding:graphics-animation-level-palette). The words are `000 ffd 100 111 b00 842 a64 532 444 544 555 754 765 776 777 976 986 a78 998 b97 ba8 b89 db8 cba ec9 eda edb feb ffb fdc c21 d32` (finding:data-formats-rgb4-palette-words). All four ATitle.res pictures, IMAG 70 to 73, decode in these colours into the Melbourne House screen, the Synergistic screen, the title screen and its logo, so the Credits and the Ring verse window are drawn in them too: colour 1 is pale yellow, colour 2 near-black red and colour 5 brown.
