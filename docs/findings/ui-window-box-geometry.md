---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x05cae
  - disasm:code+0x05cbe
  - disasm:code+0x10c16
  - disasm:code+0x07e08
  - disasm:code+0x07eb8
issue: 75
---

**A message box is fitted to its 16 by 8 frame tiles: the routine moves a box right of x 0 onto a multiple of 8, never left of 8, and rounds the width up to a multiple of 16 and the height up to a multiple of 8. On the Full Map Level it doubles x and the width first.**
The message box routine (code+0x05be2) is called with x, y, width, height, the text and the buttons. When the Level (data+0x5555) is 1, the Full Map Level, it doubles x and the width (code+0x05cae), because that screen's pixels are half as wide. If x is above 0 it clears the low three bits, and if that leaves 0 it uses 8 (code+0x05cbe). y is kept. The width is rounded up to 16 and the height to 8, so the box is a whole number of frame tiles (finding:ui-window-frame-tiles). Everything in the box is drawn into its own bitmap, so the box's contents move with it.

So the combat window, opened at x 6 (code+0x10c16), is shown at x 8, and its buttons and names sit 2 pixels further right than its arguments suggest. The War Event boxes at x 10 (finding:ui-war-event-messages) also show at 8. Galadriel's Mirror is opened at (10, 5), 272 wide and 24 deep plus 9 for each row (code+0x07e08), which on the Full Map Level becomes x 16 and 544 hi-res pixels wide. The Archive menu is opened at (168, 5), 112 by 53 (code+0x07eb8), which becomes x 336, 224 wide and 56 deep.
