---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x06ad6
  - disasm:code+0x06afc
  - disasm:code+0x06b2e
  - disasm:code+0x0751f
issue: 171
---

**When the player picks a Force to give an Order to, the Force accepts it only if the picked entry's allegiance is above a roll of 2 to 97; otherwise "The force will not accept your orders." So allegiance is the chance of obeying: 99 always obeys, 1 never, and the odd values in between are odds.**
With the arrow armed and a Character selected (code+0x06ad6), the game compares the selected entry's allegiance, byte 28, with random(96) + 2 (code+0x06afc). Above it, the Order goes on to its destination; otherwise a box at (10, 5), 176 by 24, says "The force will not accept your orders." (code+0x06b2e). The roll is made at every attempt. So mobilised Forces, 99, always obey, and unmobilised ones, 1, never do (finding:mobilisation-allegiance-byte). The other starting values are odds out of 96: Boromir's 70 obeys 68 times in 96, Gollum's 40 38 times, Glorfindel's 4 twice, the advisors' 3 once, and the Ents' 2 never.
