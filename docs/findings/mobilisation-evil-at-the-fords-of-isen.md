---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0ef60
  - disasm:code+0x0ef84
  - disasm:data+0x3e69
issue: 45
---

**An Evil Force reaching the Fords of Isen sets War Events 3 and 5, which mobilise Gondor and the Rohan musters: the only way an Evil advance mobilises a Nation.**
When an Evil Leader steps onto the tile origin of the Isen Ford, (1104, 928), the movement step sets event bits 3 and 5 if they are clear, and records the day (code+0x0ef60, code+0x0ef84). Event 3 triggers Denethor, Imrahil, the lords of the southern fiefs and Gondor's Units. Event 5 triggers the Rohan musters 0 to 4 days later (finding:ai-trigger-conditions). There is no such tripwire for the Elves or the Dwarves. They wait for event 6, which follows event 7 (finding:ai-war-events), or for their Token.
