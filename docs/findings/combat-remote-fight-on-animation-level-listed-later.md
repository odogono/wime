---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0f58a
  - disasm:code+0x0f68e
  - disasm:code+0x02864
  - disasm:code+0x028b0
  - disasm:code+0x0d048
  - observed:combat-remote-fight-on-animation-level
issue: 190
---

**A fight found while the Animation Level is showing lists its rows there only when the attacked Good Leader is the watched Character. Any other fight is listed after the Animation Level is left, with nobody watched, so the watched Character never joins a fight elsewhere.**
When the contact search finds a fight on the Animation Level (mode 3), it lists the rows at once, with the watched Character first, only if the Good party is the watched Character (code+0x0f58a). Otherwise it takes the announcement's path (code+0x0f68e) and lists nothing. When the Animation Level's loop ends, the watched Character is cleared before anything else (code+0x02864). A "Go there" then lists the Forces around the attacked Leader with nobody watched (code+0x028b0), only to choose the Level the fight is played on, and the Campaign Level's loop or the Animation Level's scene lists them again (code+0x0d048; finding:combat-animation-level-lists-the-fight-again). That last listing is in mode 2 for a fight fought in the combat window.

So the Animation Level's mode never pulls the watched Character into a fight it isn't part of. In play, with Frodo watched, Gandalf stepped onto orcs far away: both stopped, and the fight's parties were recorded, but the row list stayed the Animation Level's own, Frodo, Sam and Pippin.
