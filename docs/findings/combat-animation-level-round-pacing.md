---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x1003c
  - disasm:code+0x10df4
  - disasm:code+0x116c8
  - disasm:code+0x11ba6
  - disasm:code+0x111d2
  - disasm:code+0x12806
issue: 169
---

**A fight on the Animation Level is paced only by its messages: 300 frames before the first round, at least 180 frames for each casualty message, and 300 frames after the result. A round without a message takes no time.**
The fight waits by running the Animation Level's update until a frame count is reached (code+0x1003c), so the figures keep moving through every wait. Before the first round it holds 300 frames (code+0x10df4). An attack that prints a message first waits out the previous deadline, then shows the message and its falls and sets the deadline 180 frames on (code+0x116c8, code+0x11ba6). An attack without a message neither waits nor sets the deadline, and between rounds there is a single update (code+0x111d2), so silent rounds pass at once and their queued swings play during the next wait. After the last round the fight waits for the deadline, shows the result and holds 300 frames more (code+0x12806).
