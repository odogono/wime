---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x07180
  - resource:BScene.res#CSTR 36
  - observed:objects-use-rope
issue: 102
---

**Using the coil of rope only shows "There is no need to use the rope here.", wherever it is used, and the rope is kept.**
Its case (code+0x07180) shows BScene CSTR 36 and does nothing else, and the rope is not marked used up (finding:objects-use-table).
