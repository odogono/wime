---
kind: fact
topic: graphics
confidence: provisional
sources:
  - resource:AMaps.res#IMAG 26
  - resource:AMaps.res#IMAG 27
  - resource:AMaps.res#IMAG 28
  - resource:AMaps.res#IMAG 30
  - resource:AMaps.res#IMAG 31
  - manual:pdf-p9
  - tool:tools/extract-graphics.ts#decodeImagResource
issue: 8
---

**The Campaign Level icons appear to be AMaps.res IMAG 26 (eye), 30 (map), 28 (magnifying glass), 27 (hourglass) and 31 (arrow).**
The manual lists five Campaign Level icons — eye, map, magnifying glass, hourglass and arrow (`finding:ui-campaign-level-display`) — and each of these small AMaps.res bitmaps visibly decodes to one of them: IMAG 26 is an eye (21 by 12), IMAG 30 a map (20 by 16), IMAG 28 a magnifying glass (19 by 18), IMAG 27 an hourglass (16 by 16) and IMAG 31 a red right-pointing arrow (19 by 14). The identification is by appearance only; no code in the executable has been read to confirm which resource each icon draws, the column's order, or how the bitmaps are masked against the map. Neighbouring resources look related but are unexplained: IMAG 34 is a wider hourglass on a scroll, IMAG 41 reads "TO" with an arrow, and IMAG 10 and 40 are pointing gauntlets, probably the pointer in two colours.
