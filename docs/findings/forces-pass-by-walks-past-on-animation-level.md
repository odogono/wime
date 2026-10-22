---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0fb02
  - disasm:code+0x0fe2e
  - disasm:code+0x0ff89
  - disasm:code+0x0d036
  - disasm:code+0x02868
  - disasm:code+0x0b52c
  - disasm:code+0x0b570
  - disasm:code+0x0b29a
issue: 169
supersedes: forces-anonymous-encounters-pass-by
---

**Meeting an anonymous Encounter figure, the Rohirrim scouts included, changes nothing: on the Campaign Level it is only a message, and on the Animation Level the met figures also walk past the party while the clock stands for 420 frames.**
Every meeting with a figure of allegiance 1, such as "a Ranger" or "an old man", goes to the same code (code+0x0fb02). It shows "FRODO passes a Ranger.", "500 infantry pass by a Ranger." for a Unit, or for the scouts "FRODO is challenged by 20 Rohirrim scouts." (code+0x0ff89), and sets fightState to 6 (code+0x0fe2e). Neither party's record is written, so the figure's chance is not used up.

No code on the Campaign Level acts on fightState 6: the roster sweep tests only for 1, 2 and 3 after its encounter search (code+0x0d036), and the main loop goes down to the Animation Level for 4 and 5 but not 6 (code+0x02868). The scouts' challenge is therefore a message like any other pass-by.

On the Animation Level, when the watched Character passes by (code+0x0b52c), the scene is set up with the met figure as the Evil side, entering mirrored from the right. The party keeps walking (script entry 2) while the met figures run entry 0xb8 towards a second battle line set to −100, walking left past the party and off the screen. fightState is cleared, and a timer holds data+0x5562 for 420 frames (code+0x0b570); the roster sweep, and so the clock, does not run while data+0x5562 is set (code+0x0b29a). An unwatched Character's pass-by on the Animation Level shows the message only.
