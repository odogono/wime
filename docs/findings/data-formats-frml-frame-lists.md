---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-graphics.ts#decodeFrmlResource
  - disasm:code+0x037d8
  - resource:AAnims.res#FRML 7
  - resource:BScene.res#FRML 18
issue: 80
---

**An FRML resource is a list of animation frames for one figure: a header byte that picks 4 or 5 planes, a frame count, a six-byte entry for each frame, then the frames' bitmaps.**
The first byte is 1 for 4-plane figures (16 colours) and 0 for 5-plane ones (32 colours). The second is the number of frames. Each entry holds a big-endian 16-bit offset of the frame's bitmap from the start of the unpacked resource, then four bytes: the hot spot's x and y, and the frame's width and height in pixels. Each bitmap is stored like an IMAG one (finding:data-formats-imag-bitmaps): rows padded to whole 16-bit words, and each scanline's plane rows in turn, plane 0 first. Colour 0 is the clear background around the figure.

The routine at code+0x037d8 fetches an FRML resource, picks a frame, and subtracts the frame's hot spot from the position it is given (code+0x038a0), so the hot spot is the point of the figure that stands on that position. It keeps the frame's width and height for drawing (code+0x03944).

After the last frame every list has six bytes fewer than its header's length left over (count × 6 − 2 bytes); what they are for is unknown. For example, AAnims.res FRML 7 has 10 frames of the walking Ent, each about 56 by 87 pixels in 5 planes, and BScene.res FRML 18 has 5 small frames of arrows in flight.
