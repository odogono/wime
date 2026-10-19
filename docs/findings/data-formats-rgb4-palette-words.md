---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/render_campaign_map.py#palette_from_rgb4_words
  - resource:AMaps.res#CHAR 1
---
**Palettes in the data are stored as big-endian 16-bit Amiga RGB4 words, `0x0RGB`, with four bits each for red, green and blue.**
Each four-bit value is scaled to eight bits by multiplying by 17, so 0xF becomes 255. The first 32 bytes of the unpacked CHAR 1 resource are 16 such words, giving the 16-colour palette of the Campaign Level map tiles.
