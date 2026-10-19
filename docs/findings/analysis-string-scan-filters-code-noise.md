---
kind: lesson
topic: analysis
confidence: confirmed
sources:
  - tool:tools/extract-text.ts#looksLikeText
---

**A raw printable-string scan of a 68000 executable throws up many false strings from machine code, so the scan needs filters to be useful.**
The tool drops fragments that come from common instruction encodings (such as `NuNU`, `XOR` and `pPO`) and the resource type tags embedded in the code (`HyIMAGN`, `HyFRMLN`, `HyMMAPN`, `HyCHARN`, `HyCSTRN`). It also requires enough letters, sensible capitalisation and few stray symbols. These filters are rules of thumb: they can still let noise through and can drop genuine short strings.
