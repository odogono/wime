---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - disasm:data+0x4ac0
  - disasm:data+0x4ac8
  - disasm:code+0x0d672
  - resource:AMaps.res#IMAG 2
issue: 28
---

**The Full Map Level's 16-colour palette is a table of RGB4 words at data+0x4ac8, loaded when the Level opens.**
The Level's setup (code+0x0d672) passes data+0x4ac8 and the depth byte at data+0x4ac0 (4) to the palette call. The words are 000 888 555 755 CA8 231 351 675 58F 8BF F00 FFF 0FF F0F 2F3 FEB (finding:data-formats-rgb4-palette-words). Colouring AMaps.res IMAG 2 with them gives a correct map: cream land, blue rivers and sea, grey mountains, green forests. Colour 10 is the red of Evil dots, 14 the green, 12 the cyan of blinking dots and 15 the cream they blink to (finding:ui-full-map-dot-colours). The words at data+0x4ac2 to 0x4ac7 are 4, 5, 320 and 640, probably the depths and widths of the two screens. This replaces the hand-written "full-map" palette in the tools for this Level (finding:data-formats-imag-palettes-not-located); a second table follows at data+0x4b08 and is unexplained.
