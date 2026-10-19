---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ebb6
  - disasm:data+0x41c4
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Each roster entry has a speed class from 0 to 5 (byte 31), which picks how far it moves per step from a table of 256ths of a pixel: 336, 372, 414, 460 and 512 along the axes, and about 1/√2 of that (238, 262, 292, 326, 362) on diagonals.**
Movement adds the table entry to a fraction byte (byte 32) and moves one pixel for each whole 256 (code+0x0ebb6). The table at data+0x41c4 has two rows of six words, the straight row and then the diagonal row, each starting with 0 for class 0. Bit 0 of the facing picks the row. So class 5 covers 2 pixels a step and class 1 about 1.3. At the start Frodo, Sam, Merry, Pippin, Gimli, Dáin, the Dwarves, the Ents, Gollum, eight of the Nazgûl and the trolls of Barad-dûr are class 1. Gandalf is class 5, and the Nazgûl Lord is class 2. The Rohan riders are class 4, Aragorn, Glorfindel, Faramir and Imrahil class 3, and most others class 2. Elrond and entries 152 to 195 are class 0 and never move. This puts numbers on finding:movement-hobbits-slower-than-wizards.
