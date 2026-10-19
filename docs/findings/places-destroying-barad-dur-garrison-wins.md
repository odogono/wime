---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:code+0x13522
  - disasm:code+0x02e64
  - disasm:code+0x0dddc
  - resource:BScene.res#CSTR 55
issue: 45
---

**The player also wins by destroying the Garrison of Barad-dûr, the 9,500 orcs of roster entry 148: the game ends in victory at the end of that fight.**
Right after the Stronghold count, the end of every fight tests the strength of entry 148 (code+0x13522). At 0 it calls the winning ending (code+0x02e64), the same one the Ring reaching Mount Doom calls (code+0x0dddc). That ending shows BScene CSTR 53 to 55, closing "SO ENDS THE WAR IN MIDDLE EARTH.". The manual mentions only the Ring as a way to win (finding:objects-ring-to-mount-doom-wins). Sauron himself, entry 150, plays no part in this test.
