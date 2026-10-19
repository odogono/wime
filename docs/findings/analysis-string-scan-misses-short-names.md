---
kind: lesson
topic: analysis
confidence: provisional
sources:
  - strings:0x944d
  - strings:0x9457
  - tool:tools/extract-text.ts#extractEmbeddedStrings
---

**The executable string scan only reports runs of four or more characters, so short names such as SAM are probably missing from it.**
FRODO is at 0x944d and MERRY at 0x9457. With a zero byte after each name, that 10-byte gap holds FRODO plus exactly one three-letter name, which fits SAM. Rosters built from the scan must therefore be checked against the raw bytes, not taken as complete.
