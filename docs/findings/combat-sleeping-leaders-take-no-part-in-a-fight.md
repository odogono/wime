---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0f08e
  - disasm:code+0x04f3a
  - disasm:code+0x069e4
  - disasm:code+0x12c8c
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 166
---

**A sleeping Leader is never attacked and never drawn into a fight, and no attack wakes it. Lórien's and Thranduil's Palace's Garrisons start asleep, so at the start nothing at Lórien can be fought, and neither Stronghold can fall until its Garrison wakes.**
A moving Force looks for an enemy only among Leaders that are moving or resting, state bit 0 set (code+0x0f08e), and the rows take only awake entries (code+0x04f3a). An attack sets nobody moving: state becomes 1 only by a trigger, a player Order (code+0x069e4) or the end of a fight for its survivors (code+0x12c8c).

At the start every Leader at Lórien is asleep, its Garrison of 1,000 elves among them, 1 pixel off the Place with the Place as its destination. An Evil Force walking in finds nobody and passes through. At Thranduil's Palace only Thranduil and the 800 elves following him are awake, so they alone fight; the 500 elves of its Garrison and its other elves are left out. A sleeping Garrison can't lose strength, so its Stronghold can't count towards the three that lose the game (finding:places-stronghold-falls-with-its-garrison) until its trigger wakes it.
