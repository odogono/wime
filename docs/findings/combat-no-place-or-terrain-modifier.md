---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x109c2
  - disasm:code+0x10090
  - disasm:code+0x0f70a
issue: 45
---

**Where a fight happens doesn't change it: the combat code never looks at the Place or the terrain, and no Place has a defence value.**
The combat code (code+0x10090 to code+0x13a6a) never calls placeAt, tileAt or terrainAt, and never reads the Place table. The fight code reads the Place only to word the announcement (code+0x0f70a). The extra cost of attacking a fortress (finding:combat-defences) is therefore not a bonus tied to the Place. It can only come from the Units that defend it (finding:places-defended-by-garrison-units).
