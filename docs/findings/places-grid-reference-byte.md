---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:code+0x0ddec
  - disasm:code+0x0dfe2
  - disasm:code+0x0e01c
  - disasm:data+0x3e7a
issue: 5
---

**Each named Place carries its grid square on the printed map as a byte, which the copy protection uses: from day 92 the game asks for the map coordinates of a random Place and ends the game if the answer is wrong.**
The byte's column letter is A plus bits 1 to 3, and its row digit is the top four bits: Hobbiton's 0x32 is B3, Minas Tirith's 0x69 is E6 (code+0x0dfe2). In the daily check at hour 8 (finding:time-clock-counts-quarter-hours), once the day count reaches 92 (25 December), the game shows "The Valar seek to determine your fitness to continue this tale-weaving. Please enter the map coordinates of …" for one of Places 1 to 67 (code+0x0ddec). It accepts the right letter or the next one, and the right digit or the next one. A right answer shows "You may continue your story." and the question is never asked again; a wrong one shows "We hope you have enjoyed this preview of the game. Regrettably it must now end." and stops the game. This is why the manual's box map matters (finding:analysis-manual-box-map-missing).
