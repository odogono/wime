---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:data+0x095e
  - disasm:code+0x0bf84
  - disasm:code+0x0c9ee
issue: 80
---

**Each Animation Level figure is moved by a small bytecode script, one 252-byte script for each FRML figure set.**
The scripts are 20 records of 0xfc bytes at data+0x095e, indexed by FRML id. A figure is created at an entry point of its script, and its first byte is also the first frame shown (code+0x03880). Each byte's top three bits are the operation and its low five the argument (interpreter at code+0x0bf84, dispatch at code+0x0c9ee):

| Op   | Meaning                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0x00 | Show frame n, then wait the figure's delay                                                                                                                        |
| 0x20 | Move n pixels left as the art faces (right when mirrored), stopping at the battle lines                                                                           |
| 0x40 | Move n pixels right as the art faces (left when mirrored)                                                                                                         |
| 0x60 | Wait n × 25 plus random(n × 25) frames; n = 0 stops for good                                                                                                      |
| 0x80 | Event n: 1 lifts an object, 2 shows an object, 0xf fades the figure (FRML 16), 0x10 shoots arrows (FRML 18), 0x11 casts a spell (FRML 19); others not yet decoded |
| 0xa0 | Jump, or call with bit 0 set, to the next byte if condition n holds; n = 0x1f returns                                                                             |
| 0xc0 | Set the speed to n                                                                                                                                                |
| 0xe0 | Set the facing: 2 turns round, otherwise n & 1                                                                                                                    |

The jump conditions test the facing, the figure's x against the two battle lines (data+0x5568, data+0x556a), or a random roll out of 100 against 5, 25, 50, 75 or 95. A jump's target is the next byte, an offset within the script; calls keep up to seven return addresses. A frame change keeps the figure's hot spot still, measured from the right when mirrored (code+0x0ca36). A figure's delay starts at 10 frames and moves one step each update toward its speed (code+0x0c038).
