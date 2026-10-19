---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ec50
  - disasm:code+0x0e8aa
issue: 5
---

**Moving costs stamina (byte 34) one point a step unless the maximum stamina (byte 33) is 255. A resting entry (state 3) gets 2 points back a step, and once full it sets off again, by a 1-in-10 chance each step, between hours 5 and 13.**
Each step of movement takes a point off the current stamina when the maximum is below 255 (code+0x0ec50). The main loop gives a resting entry 2 points a step until it is back to its maximum (code+0x0e8aa). After that, while the quarter-hour count is between 21 and 51, a 1-in-10 chance each step returns it to moving. At the start every entry has full stamina: 255 for the Nazgûl, the second Gandalf, Glorfindel and the Ents, 56 for Gandalf and Gollum, 40 for Frodo and 32 for Sam, Merry and Pippin. What makes an entry stop to rest has not been traced.
