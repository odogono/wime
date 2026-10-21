---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - disasm:code+0x08be0
  - disasm:code+0x08d12
  - disasm:code+0x0b304
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**A saved game is a straight copy of the 8,330 bytes from data+0x1de8 to data+0x3e71: the roster, the route table, the object placements and the clock. The ARCHIVE.DAT shipped on Disk 1 is the starting state saved one quarter-hour into the game.**
Saving and restoring copy that range to and from the file (code+0x08be0). Because the roster holds name pointers, the code first saves the 196 pointers and puts them back after a restore (code+0x08d12). The shipped 8,330-byte ARCHIVE.DAT (finding:data-formats-save-file-archive-dat) matches the data hunk byte for byte except for the name pointers, which hold the addresses of a running game, the quarter-hour count, which is 65 instead of 64, and the records of entries that had moved. Frodo had taken three steps and each Nazgûl two. That fits one full sweep of the main loop and part of a second (finding:time-clock-advances-after-each-roster-sweep). The Animation Level gives the watched Character no extra steps (finding:time-animation-level-holds-the-sweep-at-the-watched-character), so why Frodo took one more than the Nazgûl was not traced. The match also confirms that the data hunk as loaded is the starting state.
