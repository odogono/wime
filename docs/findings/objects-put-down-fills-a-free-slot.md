---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06d8e
  - disasm:code+0x06dc4
  - disasm:code+0x06e26
  - observed:objects-put-down
issue: 102
---

**Putting an object down writes it into the first placement slot whose x is 0, at the watched Character's position, and clears it from the chosen Character's objects word.**
The code (code+0x06d8e) scans the 30 slots of data+0x3db0 (finding:objects-starting-placements) for one with x 0: an empty slot (object 99) or one whose object was taken (finding:objects-take-from-the-ground). It stores the object's number and the watched Character's x and y there (code+0x06dc4), then clears the object's bit (code+0x06e26) and starts the figure routine with 0xde, presumably the putting-down animation. If no slot is free the bit is still cleared, and the object is lost. No message is shown. The Ring cannot be put down (finding:objects-provisions-lists).

In play, Frodo put down his Elven blade at (768, 512): slot 25 went from `63 00 0000 0000` to `04 00 0300 0200`, and his objects word from 0x0091 to 0x0081.
