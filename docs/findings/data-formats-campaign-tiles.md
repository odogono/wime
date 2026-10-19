---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/render_campaign_map.py#decode_campaign_tiles
  - tool:tools/render_campaign_map.py#load_campaign_map_assets
  - resource:AMaps.res#CHAR 1
---
**The Campaign Level map is built from 320 tiles of 16 by 16 pixels in 16 colours, stored in AMaps.res as CHAR 1.**
CHAR 1 is PackBits-compressed behind a 32-bit unpacked size, and unpacks to 40,992 bytes. The first 32 bytes are the tile palette, 16 RGB4 colour words. Then come the tiles, 128 bytes each: 16 rows, and for each row four 2-byte plane rows (plane 0 first). As with IMAG resources, the leftmost pixel is the top bit and plane 0 is the lowest bit of the colour index.
