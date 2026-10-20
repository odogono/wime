---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06b5c
  - disasm:code+0x06bb4
  - disasm:code+0x06cda
  - disasm:code+0x06cf2
  - disasm:code+0x06d1a
  - observed:objects-take
issue: 102
---

**Taking an object zeroes the x of the first slot holding that object at the watched Character's position, sets its bit for the chosen Character, and shows "<name> goes to pick up <object>."; taking the Ring makes the taker the Ring-bearer.**
The code (code+0x06b5c) finds the slot (code+0x06bb4) and clears its x, leaving its object number and y. The slot then counts as free (finding:objects-put-down-fills-a-free-slot) and is no longer listed by Take, which needs both coordinates to match. The object's bit is set in the chosen Character's objects word (code+0x06cda). If the object is the Ring, the Ring-bearer byte data+0x3e6a is set to the taker (code+0x06cf2). The figure routine is started with 0xd4, presumably the walk to the object, and the message shown (code+0x06d1a). Nothing limits how much a Character carries, apart from each object having one bit: a second blue potion taken by a Character who has one is lost.

In play, Frodo took the Elven blade back from (768, 512): "FRODO goes to pick up an Elven blade.", slot 25 became `04 00 0000 0200`, and his objects word 0x0091.
