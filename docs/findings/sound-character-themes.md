---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x0fd0e
  - disasm:code+0x0fd5c
issue: 131
---

**When the window opens offering to follow a Character met, that Character's theme plays if it has one: Gandalf, Aragorn, Boromir, Frodo, Gimli, Dáin, Théoden, Denethor, Imrahil and Gollum.**
After drawing the "Follow <name>" button of the meeting window (finding:ui-meeting-window), the code switches on the Character met, encounterB, and asks for a piece (code+0x0fd5c; finding:sound-score-and-effect-table): GANDALF and the second GANDALF the Gandalf theme, ARAGORN Aragorn, BOROMIR Boromir, FRODO Frodo, GIMLI and DAIN Dwarfs, THEODEN Rohanians, DENETHOR MinasTirith.B, IMRAHIL Fortress and GOLLUM Beware. It is only asked for here: nothing loads it until the Animation Level next starts (finding:sound-place-music), presumably after "Go there".
