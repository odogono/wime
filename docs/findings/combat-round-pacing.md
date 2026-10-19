---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10df4
  - disasm:code+0x11ba6
  - disasm:code+0x122a8
  - disasm:code+0x1003c
  - disasm:code+0x17eec
issue: 45
---

**A watched fight opens with a 6-second pause for orders. After that the rounds run as fast as their messages allow, each loss message staying up at least 3.6 seconds.**
The opening message is followed by a wait of 300 frames of the 50 Hz vertical blank (code+0x10df4, code+0x17eec). Each loss message sets a deadline 180 frames ahead, which the next message waits for (code+0x11ba6, code+0x122a8). A round with no losses isn't paced at all. Option clicks are handled only during these waits (code+0x1003c), so the player gives orders between messages. An ignored fight has no waits (finding:combat-ignored-fight-resolved-at-once).
