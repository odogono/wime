---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10e9e
  - disasm:code+0x105c6
  - disasm:code+0x1062c
  - disasm:code+0x106b2
  - disasm:code+0x12c8c
issue: 45
---

**A row on Retreat leaves the fight for good: it neither strikes, is struck nor counts towards its side, and its option can't be changed again. The player can't withdraw or retreat the last Good row still fighting.**
Retreat takes the row out of every sum (code+0x10e9e), and the click handler refuses any change to a row on Retreat (code+0x106b2). It also refuses Withdraw or Retreat unless at least two Good rows are still on Charge or Engage with strength and health (code+0x1062c). When the fight ends, a retreated Character is treated like any survivor: it keeps its place on the map and is set moving again (code+0x12c8c). On the Animation Level the figure walks off.
