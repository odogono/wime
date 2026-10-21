---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0524a
  - disasm:code+0x05264
issue: 187
---

**The combat window's lines are 8 pixels when either side lists more than 16 rows, or more than 6 when the sides' cap is 9 or less; otherwise they are 9.**
Each listing of a fight's rows sets the line height (data+0x5561) at its end: 8 when the Good or the Evil side has more than 16 rows (code+0x0524a), and also 8 when the cap is 9 or 7 and either side has more than 6 (code+0x05264). The cap is 9 in a fight played on the Animation Level and 7 against a balrog (finding:combat-rows-capped-by-level-and-enemy), so those windows close their lines up much sooner.
