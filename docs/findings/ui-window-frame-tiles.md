---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x021a8
  - disasm:code+0x05be2
  - disasm:code+0x05dfc
  - disasm:code+0x05e46
  - disasm:code+0x05fda
  - resource:AMaps.res#IMAG 13
  - resource:AMaps.res#IMAG 12
  - observed:info-window-dol-amroth
issue: 75
---

**Every message box is a parchment fill in colour 15 inside a ring of 16 by 8 pixel edge tiles from AMaps.res IMAG 13, picked at random each time a box opens. Colour 0 is left clear, so the map shows through the ragged edge.**
At start-up the game loads AMaps.res IMAG 12 and IMAG 13 and keeps them at data+0x5014 and data+0x5018 (code+0x021a8). Both are 16 by 96 pixels: twelve tiles, one above the other. IMAG 13 has 4 planes and frames the boxes on the Campaign and Full Map Levels. IMAG 12 has 5 planes and is used instead when the Level (data+0x5555) is 3 and the byte at data+0x08d1 is set, presumably on the Animation Level, and then the fill is colour 1 instead of 15.

The message box routine (code+0x05be2) makes a bitmap the size of the box and fills it with colour 0. If the box is wider than 32 and deeper than 16, it fills the inside, 16 in from each side and 8 from the top and bottom, with colour 15 (code+0x05dfc). It then copies tiles around the edge (code+0x05e46), with the tile's row in the sheet chosen by the game's random bits (code+0x031c2):

| Tiles | Piece                     |
| ----- | ------------------------- |
| 0–1   | top corner, one of two    |
| 2–3   | bottom corner, one of two |
| 4–5   | top edge, one of two      |
| 6–7   | bottom edge, one of two   |
| 8–11  | side edge, one of four    |

The left side is drawn first: a corner at each end and a side edge for every 8 pixels between. Then a flag in the sheet's header (byte 2) is set and the same kinds of tile are drawn down the right side, mirrored left to right. Along the top and bottom (code+0x05fda), one 16-pixel stretch in four is left plain: parchment with a one-pixel line in colour 3 along the outer row. The others are an edge tile, mirrored or not at random. Only the corners and edges are tiles, so the colour 0 they leave outside the parchment stays clear when the box is shown.

In the Campaign Level palette (AMaps.res CHAR 1) colour 15 is #eeeebb, and the tiles draw in colours 2, 3 and 4. A capture of the info window naming DOL AMROTH, IMRAHIL, 500 knights and 700 men at arms shows the box at (8, 8): a #eeeebb fill, ragged edges in #775555, #eeaa88 and #555555, and the green map showing past the corners. The lines are 10 pixels in, starting 8 down and 9 apart, the first in colour 8 and the rest in colour 5. The text routine is called with 10 and 8 as the text's place in the box, or 20 and 8 on the Full Map Level (code+0x0614c, code+0x06126).
