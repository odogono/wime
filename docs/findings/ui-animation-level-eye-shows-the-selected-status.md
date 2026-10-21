---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x075cc
  - disasm:code+0x079ac
  - disasm:code+0x065b8
  - strings:0x8f82
  - strings:0x8fe4
  - manual:pdf-p10
  - observed:animation-level-eye
issue: 161
---

**The eye on the Animation Level shows the selected Character's status in a box at the top left: "Through the mist swirling within the glass you perceive...", its status line, then its health and what it carries, or a Unit's morale. With nobody selected it asks the player to select someone.**
The eye is button 0xf0 (finding:ui-animation-level-icons), and S does the same on this Level (code+0x065b8; finding:ui-key-bindings). Its case (code+0x075cc) closes any open box and reads the selected Character, data+0x5559 (finding:ui-animation-level-clicking-a-figure-selects-it). It does not check that the entry is in the scene or awake.

With nothing selected (code+0x079ac) it opens a box at (10, 5), 196 by 24, reading "Please select someone before requesting status." in colour 5.

Otherwise the box is at (10, 5), 260 wide, and 34 deep, plus 10 if the entry's current strength (roster word 6) is 1, plus 10 if it carries any object, plus 10 if it carries more than four (finding:ui-window-box-geometry turns this into (8, 5), 272 by 40, 48, 56 or 64). The lines, all starting at x 10:

- y 8, colour 8: "Through the mist swirling within the glass you perceive...".
- y 18, colour 5: the entry's status line, as a clicked figure shows it (code+0x04528).
- y 28, colour 5, for a Unit (current strength above 1): "They have " + rating + " morale.", the rating being current strength × 4 ÷ starting strength (word 4) of "poor", "poor", "fair", "good", "excellent" (data+0x1d1e).
- y 28, colour 5, for a Character (current strength 1): "He is " + word + ".", the word being current health × 4 ÷ maximum health (roster word 26 and byte 25) of "near death", "gravely wounded", "wounded", "slightly wounded", "hale and hardy" (data+0x1d32).
- y 38, colour 5, for a Character carrying anything: "He has " and the first four objects carried, in bit order (finding:objects-carried-as-a-bitmask), with the names from the object table.
- y 48, x 15, colour 5, if it carries more than four: the fifth to eighth. Objects beyond the eighth are not listed.

The names are joined from the table at data+0x1d0e (".", ", ", ", and ", " and "): one object gives "He has A.", two "He has A and B.", three "He has A, B, and C." and four "He has A, B, C, and D.". With five the first line ends "D, and " and the second is "E."; with six to eight the first ends "D, " and the second is "E, and F.", "E, F, and G." or "E, F, G, and H.". A dead entry (strength 0) gets no line after its status line.

The box has no buttons and closes by itself as the other such boxes do (finding:ui-war-event-messages). The Campaign Level's eye is a different case, button 0xf1, which lists the selected Force's members instead ("Peering through the orb you discern..."; finding:ui-galadriels-mirror-lists-forces-on-the-move). The manual says the eye gives the status of the Character or Force clicked on, and asks for a selection when there is none.

In FS-UAE, after Pippin was clicked on the Animation Level, the eye showed "Through the mist swirling within the glass you perceive..." in dark green, then "PIPPIN is following FRODO." and "He is hale and hardy." in blue-grey, in a box 272 by 48 at the top left. The lines about objects and morale were read from the code only.
