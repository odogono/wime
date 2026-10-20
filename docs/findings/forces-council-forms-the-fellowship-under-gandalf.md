---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0dad4
  - disasm:code+0x0db32
  - disasm:code+0x0db6c
  - disasm:code+0x0dbb8
issue: 94
---

**At the Council of Elrond, each of entries 5 to 10 whose Force stands on Rivendell is healed and, unless it follows Frodo, made a follower of Gandalf; Gandalf wakes, and the Ring-bearer follows him.**
Entries 5 to 10 are Aragorn, Boromir, Frodo, Sam, Merry and Pippin. They are taken from 10 down to 5 (code+0x0dad4). For each, the code follows its leader chain to the top; if that Leader is at (1216, 384), the entry's health is set to its maximum (code+0x0db32). Then, if its leader byte is not 7, Frodo, and entry 1's strength is not 0, its leader becomes entry 1 (code+0x0db6c). A Leader whose chain is changed earlier in the loop is seen with its new chain later in it, so an entry whose chain now ends at Gandalf, still at (1216, 380), is neither healed nor moved.

If entry 1's strength is not 0, his state is set to 1, moving, and his trigger byte cleared (code+0x0dbbe), and the Ring-bearer, unless he is entry 1 himself, is made a follower of entry 1 (code+0x0dbc8). The Ring-bearer's own followers stay with him, so the whole Force joins Gandalf's.
