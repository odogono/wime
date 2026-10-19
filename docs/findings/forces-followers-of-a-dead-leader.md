---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x12d9c
  - disasm:code+0x12e70
  - disasm:code+0x12ef2
  - disasm:code+0x12fb2
  - disasm:code+0x12fd6
issue: 45
---

**After a fight, a follower whose Leader died follows the next living Leader up its chain. If there is none, it becomes a Force of its own, taking over the dead Leader's destination.**
The check covers every awake Good-side entry after every fight (code+0x12d9c). A follower with a living Leader higher up now follows that one: "<name> is now following <Leader>." (code+0x12e70). One with no living Leader above it is "now on his own." (code+0x12ef2). It takes the dead Leader's position, destination and facing, and its own Default Orders are cut (code+0x12fb2). If its own allegiance is below 4 it also takes the dead Leader's allegiance (code+0x12fd6). The messages appear only after a fight the player ignored.
