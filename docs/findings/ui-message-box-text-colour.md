---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x05be2
  - disasm:code+0x06118
  - disasm:code+0x03262
  - disasm:code+0x03a54
issue: 105
---

**The message box routine's sixth argument is the colour of its text, not its buttons: a box is opened with x, y, width, height, a text and a colour, and the text is drawn at (10, 8) in that colour unless the colour is 0. Longer lines are drawn into the box afterwards by two helpers.**
The message box routine (code+0x05be2; finding:ui-window-box-geometry) ends by drawing its text into the box (code+0x06118) through the text routine code+0x187f2, at (10, 8) or (20, 8) on the Full Map Level, in the colour given as its last argument. Boxes that build their text from pieces pass an empty text and colour 0, then call code+0x03262 with the box, x, y, a colour, a count and that many strings, which are drawn one after another on one line. Buttons are drawn by code+0x03a54 with a text, the box, x, y, a colour, three flags and a button number: the text goes at (x + 2, y); with the first flag set the area from (x, y - 1), 4 wider than the text, becomes the button; with the second a frame in the same colour is drawn from (x - 1, y - 2), 6 wider and 2 deeper than the text. The third flag is passed on with the button number and was not traced.
