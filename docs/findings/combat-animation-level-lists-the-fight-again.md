---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0a316
  - disasm:code+0x0a356
  - disasm:code+0x04e5e
  - disasm:code+0x04f52
  - disasm:code+0x0a3de
  - disasm:code+0x0d098
issue: 187
---

**When a fight is played on the Animation Level, its scene lists the rows again around the watched Character: that Character and its followers come first, and each side holds at most 9 rows, or 7 against a balrog.**
The scene's set-up (code+0x0a316) lists the Forces near the watched Character's position (code+0x0a356) with the fight already handed to the Animation Level, so the caps of finding:combat-rows-capped-by-level-and-enemy apply. On the Animation Level the watched Character is listed as the first row with its followers, cut to the cap, and is skipped when the Leaders are taken in roster order (code+0x04e5e, code+0x04f52). The rows that decided where the fight is played can therefore differ from the rows that fight it. An Encounter is again the only Evil row (code+0x0a3de), as it is in the combat window (code+0x0d098).
