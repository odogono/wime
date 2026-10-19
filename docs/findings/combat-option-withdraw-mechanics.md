---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10f18
  - disasm:code+0x1123a
  - disasm:code+0x11cbe
  - disasm:code+0x11c66
  - disasm:code+0x124c8
issue: 45
---

**A withdrawn row neither strikes nor is struck, but it still counts towards its side's strength. As soon as any Good row is wiped out, every withdrawn row is put back on Engage.**
Withdrawn rows are skipped when blows are dealt and losses taken (code+0x10f18, code+0x1123a, code+0x11cbe). A wiped-out Good row sets a flag (code+0x11c66), and at the end of that round each Withdraw becomes Engage (code+0x124c8). On the Animation Level the figure walks back into the melee. This is how withdrawn Characters come to be attacked again (finding:combat-option-withdraw).
