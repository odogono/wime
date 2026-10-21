---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x06826
  - disasm:code+0x0528c
  - disasm:code+0x053c2
  - disasm:code+0x075b6
  - disasm:code+0x08eea
  - disasm:code+0x057e4
  - disasm:code+0x058fe
issue: 168
---

**A press off a message box's buttons does not close it. The box is not a target for clicks: a click goes to whatever lies at the pointer. On an empty spot of the map nothing happens. A click on a Force or a Place on the Campaign Level closes the box, answering a box with buttons with its default, and opens that Force's or Place's box. While a box with buttons is up, the icons do nothing.**
A click (code+0x06826) is resolved by the hit test at code+0x0528c into a button id in lastButton, data+0x5552, which the dispatcher at code+0x075b6 acts on. Only the boxes' own button ids, 0xb4 to 0xc3 and 0xfe, have handlers that close it (the table at code+0x08eea); any other id falls through and changes nothing. While a box has a default button, the hit test also refuses the icons, ids 0xf1 to 0xf8 (code+0x053c2). A click on an empty spot of the Campaign Level map gives id 0xff (code+0x057e4), which has no handler.

A click on the map that finds Forces or a Place does act: it closes the open box (code+0x05682, code+0x058fe) or opens its own box through the routine that waits for and closes the open one (finding:ui-message-box-opening-waits-for-the-open-box). Either way the open box's default is pressed and the list or the Place's box replaces it. The same holds for a box without buttons, except that there is no default to press. Keys work the same way: N presses the default and Y the other button (code+0x06520, code+0x06504), and X closes the box to ask about quitting (code+0x0665e).
