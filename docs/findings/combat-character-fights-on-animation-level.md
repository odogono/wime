---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0a316
  - disasm:code+0x0b336
  - disasm:code+0x0b5e6
  - disasm:code+0x109c2
  - disasm:code+0x1303a
issue: 81
---

**A fight played out on the Animation Level uses the same rounds, rows and options as the combat window; only the drawing differs.**
The scene is set up with an Encounter as the single Evil row, or a met Force as its rows (code+0x0a316). The two battle lines are placed 25 and 85 pixels past the rightmost Good figure, or at 100 when a balrog leads the Evil side (code+0x0b336). Both sides' figures walk to them, and once both scripts report they have arrived, the combat routine of the combat window runs (code+0x0b5e6, code+0x109c2; finding:combat-where-a-fight-is-fought). On the Animation Level it adds music, a charging or engaging animation for the rows that Charge or Engage, and falls in proportion to the losses. Losses, followers and the Ring are written back as after any fight. The surviving Good figures then walk on (code+0x1303a).
