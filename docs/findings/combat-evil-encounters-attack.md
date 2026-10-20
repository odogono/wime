---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0f382
  - disasm:code+0x0f46c
  - disasm:code+0x0f58a
  - disasm:code+0x0f68e
  - disasm:code+0x12ff2
issue: 81
---

**An Evil Encounter attacks like any Evil Force, after an evasion roll, and is never used up: after every fight its health is restored and it waits to be met again.**
The Force met may evade first (code+0x0f382), on the average evasion of its members plus 20 for a magic weapon (finding:combat-evasion-chance), showing "FRODO evades a balrog." on the Campaign Level. Units never evade, nor does anyone at two set tiles, (1200, 400) and (1744, 1008), or when met by Shelob (151) or a balrog (183 to 187). A Force with a Unit ignores small Encounters (starting strength below 99) altogether (code+0x0f46c).

When the watched Character is attacked on the Animation Level, "FRODO is attacked by a balrog." shows with no buttons, and the fight starts there, or on the Campaign Level if the Good side has a Unit (code+0x0f58a). Elsewhere the fight announcement offers "Go there" and "Ignore it" (code+0x0f68e; finding:ui-fight-announcement). After every fight the health of entries 152 to 195 is reset to its maximum (code+0x12ff2).
