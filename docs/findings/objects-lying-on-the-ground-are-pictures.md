---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x0c2a6
  - disasm:code+0x06b5e
  - disasm:code+0x074d6
issue: 105
---

**On the Animation Level an object on the ground is a picture that is also button 0x99 plus the object's number, the same number as its line in the lists; clicking it outside a list shows the object's name in a box at (10, 5), 100 by 24, in colour 5.**
The put-down script makes the picture with kind 0x95 and button 0x99 + object (code+0x0c2a6), and Take finds the picture to remove by that number (finding:objects-take-message). The object handler (code+0x06b5e) treats any button from 0x99 to 0xa8: if no list is open (data+0x5556 not 0xbf, 0xc0 or 0xc1) it shows the object's name (code+0x074d6) without buttons.
