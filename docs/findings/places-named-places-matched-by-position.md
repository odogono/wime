---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:data+0x3e72
  - disasm:code+0x0e342
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**The 69 named Places are a table of 10-byte records at data+0x3e72, numbered from 1 (Annúminas) to 69 (the Rammas forts). A point is at a named Place only if its tile-aligned position equals the Place's exactly.**
Each record holds a pointer to the name, the x and y position and a grid byte (finding:places-grid-reference-byte); the last byte is 0. Record 0 is empty. To find the Place at a point, the game rounds the point down to its tile and compares it with each named Place's position in turn (code+0x0e342). The order runs roughly west to east and north to south, from Annúminas, Hobbiton and the Shire through Rivendell, the North, Lórien and Rohan to Gondor and Mordor, then the Harad Road. Green Hills (68) and the Rammas forts (69) come last.
