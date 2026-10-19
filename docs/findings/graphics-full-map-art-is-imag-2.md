---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - resource:AMaps.res#IMAG 2
  - tool:tools/extract-graphics.ts#decodeImagResource
  - disasm:code+0x0d452
  - disasm:data+0x4ac8
  - observed:full-map-at-start
issue: 29
---

**AMaps.res IMAG 2 contains the Full Map Level art at 640 by 200 pixels in four bit planes.**
Decoding it produces the map of Middle Earth, with the coast, mountain ranges,
rivers, compass and region names visible. It is twice the pixel width of the
Campaign Level, so exporting it preserves all 640 columns. The bitmap contains
colour indices; its palette is at data+0x4ac8
(`finding:data-formats-full-map-palette`).

The Level's draw routine (code+0x0d452) loads IMAG 2 and copies it, at the width in data+0x4ac6 (640) and a height of 200, to the screen, so this is the art the game shows. Coloured with the palette at data+0x4ac8 it matches the Full Map seen in FS-UAE. In play the 200 lines fill the top of the PAL display and the rest stays black, which settles what finding:graphics-full-screen-art-is-320-by-200 could only guess for this Level.
