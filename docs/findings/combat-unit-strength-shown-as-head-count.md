---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x102bc
  - disasm:code+0x04fca
  - disasm:code+0x17d2c
  - observed:combat-faramir-go-there
issue: 45
supersedes: combat-unit-strength-shown-in-hundreds
---

**The combat window shows a Unit's actual head count before its name, not hundreds; a Character's name stands alone.**
The row's strength is the sum of the current strength (byte 6) of the entries in the row (code+0x04fca). When it is above 1 it is printed in decimal before the name (code+0x102bc, code+0x17d2c). In play the rows read "200 Rangers" and "444 orcs", and the number fell as the Units lost men: "173 Rangers", "191 orcs". The manual's "20 Lt. Inf." would be a Unit 20 strong.
