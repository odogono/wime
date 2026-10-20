---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x08616
  - disasm:code+0x087d6
  - disasm:code+0x089d6
  - disasm:data+0x4348
issue: 102
---

**Put Down lists every object the chosen Character carries except the Ring, Take lists up to seven objects lying exactly where the watched Character stands, and Use lists only the carried objects marked usable.**
Each choice of the provisions icon (finding:objects-handled-on-animation-level) opens a window headed "Select the object for <name> to drop:", "… to get:" or "… to use:", one line per object, in object order.

- **Put Down** (code+0x08616) walks bits 1 to 15 of the chosen Character's objects word (finding:objects-carried-as-a-bitmask). Bit 0, the Ring, is never offered, so the Ring cannot be put down. With nothing else carried the message is "<name> is unwilling to part with anything."
- **Take** (code+0x087d6) walks the 30 placement slots (finding:objects-starting-placements) and lists each whose x and y equal the watched Character's position, stopping at the seventh. It is the only way back to a dropped Ring (finding:objects-dead-drop-their-objects). With none the message is "There are no objects here."
- **Use** (code+0x089d6) walks bits 1 to 15 and lists those whose object record has its usable byte set (byte 6, data+0x4348; finding:objects-use-table). With none the message is "<name> has nothing which is 'usable'."

The chosen Character acts, but Take and Put Down use the watched Character's position, which is the position of the Force on screen.
