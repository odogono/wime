---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06d8e
  - disasm:code+0x06dc4
  - disasm:code+0x06e26
  - disasm:code+0x06e3e
  - disasm:code+0x0c248
  - disasm:code+0x0c2ec
issue: 105
supersedes: objects-put-down-fills-a-free-slot
---

**Putting an object down writes it into the first placement slot whose x is 0, at the watched Character's position, and clears it from the chosen Character's objects word at once; the message "<name> puts down <object>." comes later, when the figure's put-down animation places the object's picture on the ground.**
The handler (code+0x06d8e) marks an order as under way (data+0x08cd), scans the 30 slots of data+0x3db0 (finding:objects-starting-placements) for one with x 0, an empty slot (object 99) or one whose object was taken (finding:objects-take-from-the-ground), and stores the object's number and the watched Character's x and y there (code+0x06dc4). It clears the object's bit (code+0x06e26), gives the chosen Character's figure command 0xde (code+0x06e3e) and closes the list, showing nothing. If no slot is free the bit is still cleared, and the object is lost. The Ring cannot be put down (finding:objects-provisions-lists).

Step 2 of the figure's script (code+0x0c248) then adds a picture of the object at the figure's feet, with the object record's byte 4 as its picture and button number 0x99 plus the object (finding:objects-lying-on-the-ground-are-pictures), unless six such pictures are already up. It opens a box at (10, 5), 176 by 24, and draws "<name> puts down <object>." at (10, 8) in colour 5, without buttons (code+0x0c2ec).

In play, Frodo put down his Elven blade at (768, 512): slot 25 went from `63 00 0000 0000` to `04 00 0300 0200`, and his objects word from 0x0091 to 0x0081.
