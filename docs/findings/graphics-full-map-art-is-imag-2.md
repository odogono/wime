---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - resource:AMaps.res#IMAG 2
  - tool:tools/extract-graphics.ts#decodeImagResource
issue: 29
---

**AMaps.res IMAG 2 contains the Full Map Level art at 640 by 200 pixels in four bit planes.**
Decoding it produces the map of Middle Earth, with the coast, mountain ranges,
rivers, compass and region names visible. It is twice the pixel width of the
Campaign Level, so exporting it preserves all 640 columns. The bitmap contains
colour indices; its palette is still unverified
(`finding:data-formats-imag-palettes-not-located`).
