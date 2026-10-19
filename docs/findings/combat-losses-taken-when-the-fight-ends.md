---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x1287a
  - disasm:code+0x128be
  - disasm:code+0x12980
  - disasm:code+0x129d4
  - disasm:code+0x129dc
  - disasm:code+0x12c8c
  - observed:combat-calembel-ignored
  - observed:combat-east-emnet-ignored
  - observed:combat-faramir-go-there
issue: 45
---

**When a fight ends, each row's losses are taken from its entries in roster order. A Character or Unit left with no strength or no health is dead, and every survivor is set moving again.**
A row's loss is its strength at the start less its strength at the end (code+0x1287a). It is taken from awake entries with the same name whose Force stands within 8 pixels of the fight, each giving up as much strength as it has (code+0x128be, code+0x12980). A dead entry has its strength and state set to 0 (code+0x129d4, code+0x129dc). Its position, Leader, health and objects word are left as they were. Each survivor's state is set to 1, which releases it from the fight (code+0x12c8c), even if it had been resting.

In play the orcs that killed Faramir had been resting and were moving again afterwards. Éomer and Faramir were dead with strength 0 but kept their health. The infantry at Calembel went from 1,000 to 864 and the 500 orcs facing them to 0.
