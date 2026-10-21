---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0285c
  - disasm:code+0x09e02
  - disasm:code+0x0b220
  - disasm:code+0x0b254
  - disasm:code+0x0b274
  - disasm:code+0x0ed34
  - disasm:code+0x0aada
  - observed:animation-level-frodo-from-the-glass
issue: 160
---

**Going down to the Animation Level changes nothing about the watched Character's Force: it keeps its state, its destination and its followers. While it travels, it moves on the map one pixel each time its figures walk off the right edge, and the next scene is built where it now stands; once it has no destination, its figures walking off take the game up to the Campaign Level.**
The main loop only sets the watched entry before running the Animation Level (code+0x0285c), and entering the Level writes nothing in the roster (code+0x09e02). The Force goes on under its Order or Default Orders, and its pace is the one it has on the Campaign Level, but its moves are held back to the walk of its figures (finding:time-animation-level-holds-the-sweep-at-the-watched-character).

The Level watches the leftmost figure's x (code+0x0b220). When it passes 330, the loop tests the watched entry's destination x, roster byte 12 (code+0x0b254). If the Character has a destination, the loop calls the tick once (code+0x0b274): that applies the held pixel and, because the call is made on the Animation Level with argument 0, rebuilds the scene through code+0x0aada (code+0x0ed34), with fresh scenery for the new spot and the figures walking in again from the left. If it has no destination, the Level ends and the Campaign Level comes up. It ends the same way if the memory for the map has been given back to the system (data+0x08d8 cleared, code+0x09f20).

In FS-UAE, Frodo kept his destination (656, 400) and state 1 through every scene, and his position went up by one pixel in x and y at each walk-off. Each new scene had different scenery, and Encounters such as "FRODO passes a Ranger." came in between.
