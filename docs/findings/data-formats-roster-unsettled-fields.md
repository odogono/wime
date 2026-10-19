---
kind: fact
topic: data-formats
confidence: provisional
sources:
  - disasm:data+0x1de8
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Four bytes of each roster record have no settled meaning yet: bytes 19, 24 and 37, and byte 29 for entries 1 to 151.**
No instruction reads byte 19 directly. It varies between Characters (Gandalf 4, Aragorn 14, Boromir 24, Frodo 5) and among Units of one Nation, so it may be read as part of a larger structure. Byte 24 is 3 for the most powerful figures (Gandalf, Elrond, Glorfindel, the Nazgûl, Sauron, the Balrogs), 2 for trolls and Shelob, 1 for Aragorn and 0 for most others; it may be a magic or armour level. Byte 29 for entries 1 to 151 is 75 for Gandalf and Legolas, 60 for Aragorn, Boromir and Gimli, 30 for the Hobbits and 210 for Gollum, and 0 for every Unit. Byte 37 is always 0 and may be padding. The extractor exports these bytes raw.
