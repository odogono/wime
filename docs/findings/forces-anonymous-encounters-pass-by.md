---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0fe04
  - disasm:code+0x0ff89
issue: 81
---

**The anonymous Encounter figures, such as "a Ranger" or "an old man", only pass by: a one-line message with no choice, and nothing changes.**
The message is "FRODO passes a Ranger." for a single Character and "500 infantry pass by a Ranger." for a Unit (code+0x0ffa4, code+0x0ff99). The Rohirrim scouts instead give "FRODO is challenged by 20 Rohirrim scouts." (code+0x0ff89). The meeting sets fightState 6 (code+0x0fe04) and changes neither party. What the scouts' challenge does on the Campaign Level, where no handler for fightState 6 was found, is unknown.
