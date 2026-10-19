---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x12d58
  - disasm:code+0x12ff2
issue: 45
---

**After every fight the Evil side's Characters and Units, and every Encounter, are healed to full health; the Good side's wounded stay wounded.**
The end of a fight copies maximum health over current health for each entry of an Evil row (code+0x12d58), and for all of entries 152 to 195 (code+0x12ff2). A wounded Nazgûl therefore never carries its wounds into the next fight, while a Good Character needs healing (finding:forces-health).
