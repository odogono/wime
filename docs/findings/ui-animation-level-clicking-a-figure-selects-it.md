---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x05628
  - disasm:code+0x05678
  - disasm:code+0x056da
  - disasm:code+0x028fc
  - disasm:code+0x08252
  - observed:animation-level-figure-click
issue: 161
---

**Clicking a figure on the Animation Level shows that entry's status line in a small box at the top left, and if the entry is one of roster entries 1 to 78 it becomes the selected Character. The watched Character does not change, and nothing is selected or shown during a fight.**
When the click (finding:ui-animation-level-click-takes-the-frontmost-figure) lands on a figure and no fight is being set up or played (fightState, data+0x4ff0, not 1 or 2; code+0x05628), the routine closes any box already open (code+0x05b46), opens a box at (10, 5), 208 by 24, with no text and no buttons, and writes the figure's roster entry's status line into it at (10, 8) (code+0x05678). The line is the one Galadriel's Mirror uses (code+0x04528; finding:ui-galadriels-mirror-lists-forces-on-the-move), such as "PIPPIN is following FRODO." or "FRODO is going to GREEN HILLS.", in colour 5. The box shows at (8, 5) (finding:ui-window-box-geometry) and closes by itself like the other boxes without buttons (finding:ui-war-event-messages). Then, if the entry is below 79, it is written to the selected Character, data+0x5559 (code+0x056da). This covers the Good Characters and Units and Gollum (finding:forces-roster-order); an Evil figure, or an Encounter figure (entries 152 to 195), shows its line but leaves the selection alone. A still-picture Encounter figure, which is not an FRML figure, gives the box only when its object's byte 9 is 0x50 or more; what that byte holds for those pictures was not traced. The click plays no flash (the figure is not flagged for one) and the routine makes no sound call.

During a fight (fightState 1 or 2) the click returns the figure's entry as a button number instead (code+0x056ea), shows nothing and selects no one; what the fight code does with it was not traced.

The selected Character is one byte for the whole game, not a property of the scene. The Animation Level's eye (finding:ui-animation-level-eye-shows-the-selected-status) and sack (finding:ui-provisions-chosen-character) read it, and so do the Campaign Level's icons. It stays until something else writes it: the magnifying glass (finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot), an Encounter (code+0x028c8, code+0x0842e, code+0x0d0e2), the sack's fallback, which writes the member it picks back into it (code+0x08252), and the endings, which clear it. The watched Character (data+0x08cc) is separate: a click does not change whom the scene follows. When the Campaign Level next goes down to the Animation Level, the main loop copies the selected Character into the watched one (code+0x028fc).

In FS-UAE, on the Animation Level watching Frodo (entry 7), a click on Pippin showed "PIPPIN is following FRODO." in a box at the top left and set data+0x5559 to 10, while data+0x08cc stayed 7 and the scene went on.
