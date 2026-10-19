---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/render-campaign-map.ts#renderRawMap
  - tool:tools/render-campaign-map.ts#renderCampaignOutputs
  - resource:AMaps.res#MMAP 1
---
**The Campaign Level terrain is a grid of one-byte tile numbers, 160 tiles wide and 99 high, stored row by row in AMaps.res as MMAP 1.**
MMAP 1 is PackBits-compressed behind a 32-bit unpacked size and unpacks to 16,256 bytes. Byte `y * 160 + x` gives the tile for column x of row y, so the whole map is 2,560 by 1,584 pixels. The first 17 bytes are tile 0. The grid uses only the first 15,840 bytes; the last 416 bytes look like a different kind of data and are not yet explained. Because each entry is a single byte, only tiles 0 to 255 can be placed through the grid, although CHAR 1 holds 320 tiles; what the other 64 are for is unknown.
