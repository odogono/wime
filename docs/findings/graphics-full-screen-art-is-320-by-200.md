---
kind: fact
topic: graphics
confidence: provisional
sources:
  - resource:ATitle.res#IMAG 72
  - resource:BScene.res#IMAG 300
  - resource:AMaps.res#IMAG 2
  - tool:tools/extract-graphics.ts#decodeImagResource
issue: 4
---
**Full-screen art in the original is 320 by 200 pixels, so the game probably draws to a 200-line screen.**
The title screen (ATitle.res IMAG 72) and nine Animation Level backgrounds in BScene.res (IMAG 300 among them) are all 320 by 200 pixels in 5 planes, and no image in the game is taller than 200 pixels. The only larger image, AMaps.res IMAG 2, is 640 by 200 in 4 planes, probably the Full Map Level in hi-res. These are exactly the Apple IIgs screen sizes, which fits the art coming over from that version (see `analysis-resource-forks-suggest-apple-heritage`). The Amiga version could still open a 256-line PAL screen and leave the bottom 56 lines unused: the screen setup has not been read from the executable.
