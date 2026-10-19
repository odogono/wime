---
kind: lesson
topic: analysis
confidence: confirmed
sources:
  - tool:tools/extract-starting-state.ts#parseHunkFile
  - disasm:data+0x1de8
issue: 5
---

**Listing the data hunk's relocations finds the starting-state tables before any disassembly: each table of records with a name pointer shows up as a run of relocations at a fixed stride.**
The 438 relocations from the data hunk into the code hunk fall into runs: every 38 bytes from data+0x1de8 (the 196-entry roster), every 10 bytes from data+0x3e72 (the Places), every 8 bytes from data+0x4342 (the objects) and every 6 bytes from data+0x0000 (a jump table). The stride gives the record size, and following each pointer gives the record's name. This is much quicker than tracing the code, and it is how the tables in `docs/re/starting-state-tables.md` were found. The field meanings then came from the code that reads each field.
