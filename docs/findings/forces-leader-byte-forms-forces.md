---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0da36
  - disasm:code+0x0d4e2
  - disasm:code+0x0e886
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**A Force is a chain of leader bytes: each roster entry names the entry it follows, and the entry at the end of the chain, with no leader of its own, leads the Force and holds its position.**
Byte 35 of a roster record is the index of its leader, or 0. The code walks the chain to its end to find where an entry is (code+0x0da36). Only entries with no leader are drawn on the Full Map and Campaign Levels (code+0x0d4e2) or moved by the main loop (code+0x0e886). At the start, followers have position 0,0. So the starting Forces are: Frodo with Sam and Pippin; Gandalf with Boromir, Legolas and Gimli; and each lord of Rohan, Gondor, Dale, Erebor and the Elves with the Units listed after him. Every other entry leads a Force of one.
