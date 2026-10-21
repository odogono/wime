---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x056da
  - disasm:code+0x080fe
  - disasm:code+0x081a2
  - disasm:code+0x08206
  - disasm:code+0x0823a
issue: 105
---

**The Character the provisions window acts for is the last figure clicked, if that Character is awake and in the Force on screen; otherwise the first awake member of the Force. If that member is a Unit rather than a Character, the window does not open and "Please select an active member of the party." is shown instead.**
Clicking a figure records its roster index as the chosen Character (data+0x5559, code+0x056da), if it is entry 1 to 78; this is the game's one selected Character, which the magnifying glass and Encounters also set (finding:ui-animation-level-clicking-a-figure-selects-it). The provisions case (code+0x080fe) looks for that index among the Force's rows (data+0x548a, counted by data+0x555d) and keeps it if its state, roster byte 22, is not 0, asleep. Otherwise it takes the first row whose state is not 0, and writes it back as the selected Character (code+0x08252). If no row qualifies, or the row's starting strength (roster word 4) is above 1, the case shows "Please select an active member\nof the party." in a box at (10, 5), 100 by 34, in colour 5, without buttons (code+0x081d8). There is no list of the party to choose from.

While a Take or Put Down is still being acted out (data+0x08cd, set by finding:objects-take-from-the-ground and finding:objects-put-down-message-after-the-animation), it shows "Please wait for the first\norder to be finished." in the same box (code+0x08206) instead.
