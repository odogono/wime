---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x12b38
  - disasm:code+0x12b78
  - disasm:code+0x12bc8
  - disasm:data+0x3db0
issue: 45
---

**Everything a Character carried when killed, the Ring included, is left lying at the place of the fight, where it can be picked up like any other placed object.**
For each bit set in the dead entry's objects word (code+0x12b38), the code fills a free slot of the object placements table (data+0x3db0) with the object and the fight's position (code+0x12b78). On the Animation Level the objects other than the Ring are also drawn beside the body (code+0x12bc8). This is how survivors can take the dead's objects (finding:combat-victory-and-defeat-aftermath). The dead entry's own objects word is not cleared.
