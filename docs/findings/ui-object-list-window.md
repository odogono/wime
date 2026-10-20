---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x08674
  - disasm:code+0x086d0
  - disasm:code+0x08702
  - disasm:code+0x0875c
  - disasm:code+0x08860
  - disasm:code+0x08a48
issue: 105
---

**Each object list opens at (112, 5), 176 wide and 28 + 10 × n deep for n objects, with its heading at (10, 8) in colour 8 and one unframed line per object at x 15 and y 20 + 10 × i in colour 5. An object's line is button 0x99 plus its number. There is no Cancel: like the provisions window it closes itself after 1,020 frames.**
Put Down (code+0x08674), Take (code+0x08860) and Use (code+0x08a48) count the objects to list (finding:objects-provisions-lists) and open the box with an empty text. The heading "Select the object for <name> to drop:", "… to get:" or "… to use:" is drawn in three pieces (code+0x086d0; finding:ui-message-box-text-colour). Each line (code+0x08702) is the object's name, a button without a frame, numbered 0x99 + the object's number, so 0x9a to 0xa8; i counts the lines drawn, from 0. The box is shown with default button 0xb4 (code+0x0875c), which closes it, as in finding:ui-provisions-window. The clock stays stopped and the figures halted while it is open.

Choosing a line sends its button to the object handler (code+0x06b5c), which acts according to the list it came from (finding:objects-take-from-the-ground, finding:objects-put-down-message-after-the-animation, finding:objects-use-table).
