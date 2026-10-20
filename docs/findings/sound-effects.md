---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x02116
  - disasm:code+0x0237c
  - disasm:code+0x109ce
  - disasm:code+0x062ec
  - disasm:code+0x0bd4c
  - disasm:code+0x0c5d4
  - disasm:code+0x05550
issue: 131
---

**The game has four sound effects, all instruments: a bell, ReverbBells, as every message box opens, and a whoosh, a sword and magic during fights on the Animation Level.**
The effect player (code+0x02116) plays instrument slot n of the table at data+0x5632, if sound is on. At start-up slots 4 and 5 get ReverbBells (code+0x0237c). When a fight starts and is not ignored, and only if there was memory to spare (finding:sound-full-arrangements-need-memory), slots 1 to 3 get Whoosh, Magic and Sword from Disk 2 (code+0x109ce; finding:sound-score-and-effect-table).

- ReverbBells, slot 4, as the message box routine shows a box (code+0x062ec), so with every window.
- ReverbBells, slot 5, from code+0x05550 and code+0x057fe, after a picture is copied into a box; what these boxes are was not traced.
- Whoosh or Sword at random, as an Animation Level figure is drawn whose record has 9 or 0x0b in byte 3 (code+0x0bd4c); what byte 3 holds was not traced.
- Magic from two steps of the figure scripts (code+0x0c5d4, code+0x0c63a); which figures was not traced.
