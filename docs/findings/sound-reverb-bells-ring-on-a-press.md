---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x0528c
  - disasm:code+0x05550
  - disasm:code+0x057fe
  - disasm:code+0x03b6c
  - disasm:code+0x03788
  - disasm:code+0x0650a
issue: 170
---

**The second ReverbBells rings when the player clicks an icon or a button, as it starts to flash, and when the magnifying glass finds Forces near the spot it is put down on.**
The click routine (code+0x0528c; finding:ui-animation-level-click-takes-the-frontmost-figure) flashes a clicked object whose byte 4 has bit 0 set, and just before the flashes it plays effect slot 5, ReverbBells (code+0x05550). The icons have that bit. So do the buttons: the button routine passes its third flag, the one finding:ui-message-box-text-colour left untraced, into byte 4 of the clickable area it registers (code+0x03b6c, code+0x03788). Every button in the game sets it: Yes and No, the Archive's, the Game Speed window's, the Provisions menu's and the lines of its object lists, "Go there" and "Ignore it", and the meeting window's. So a click on any button or icon rings ReverbBells, and the box that click opens rings it again (finding:sound-fight-effects). The N and Y keys write their button straight into the last button pressed (code+0x0650a, code+0x06526), bypassing the click routine, so they ring nothing of their own.

The magnifying glass rings it too, once it has listed Forces near the spot, before the first row's icon flashes four times (code+0x057fe; finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot). A spot with nobody near rings nothing.
