---
kind: fact
topic: executable
confidence: confirmed
sources:
  - tool:tools/extract-text.ts#extractTextArchive
---

**The game program is the file `WarInMiddleEarth` on Disk 1, a 137,424-byte Amiga hunk executable.**
It starts with the long word `0x000003F3`, the AmigaDOS hunk header. Its data includes the user-interface messages ("The Game is Paused.", "Sound is now off.", "Are you certain you want to quit?") and the roster and Place name tables.
