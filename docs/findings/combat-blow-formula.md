---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10e92
  - disasm:code+0x10f36
  - disasm:code+0x10f5c
  - disasm:code+0x10f7a
  - disasm:code+0x10f96
  - disasm:code+0x10fe6
issue: 45
---

**Each round a Character strikes a blow of (r + 1) × F / 8, and a Unit one of S × F × r / 16. F is the row's fighting strength (byte 23), S its head count and r a random number from 0 to 7.**
The blows are worked out for every row on both sides before any losses are taken (code+0x10e92), so there is no first strike. A Character also adds F one round in five, and when it does, one time in twenty the whole blow is multiplied by 16 (code+0x10f5c, code+0x10f7a). The divisions round down. A row on Charge adds S × F (code+0x10fe6). A row on Withdraw, Retreat or gone strikes nothing. Each side's blows are added together, kept apart only by whether the striker has a magic weapon (finding:combat-magic-weapons-and-protection).

On average a Unit strikes about 0.22 × S × F a round, and a Character about 0.56 × F, plus F one round in five.
