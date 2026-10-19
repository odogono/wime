---
kind: fact
topic: data-formats
confidence: provisional
sources:
  - tool:tools/extract_graphics.py#default_palette
  - tool:tools/extract_graphics.py#map_palette
  - tool:tools/extract_graphics.py#palette_for_resource_file
---
**The palettes used to colour IMAG resources have not been found in the game data; the tools use two hand-written palettes instead.**
IMAG resources carry colour indices only. The tool colours those from AMaps.res with a hand-entered 16-colour "full-map" palette, and all others with a hand-entered 32-colour "art" palette, and its comment claims the game uses the latter. Neither table is read from the game files, so the exact colours are unverified. Only the map tile palette in CHAR 1 is known to come from the data.
