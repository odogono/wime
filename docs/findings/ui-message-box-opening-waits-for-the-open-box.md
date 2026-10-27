---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x05be2
  - disasm:code+0x05bfe
  - disasm:code+0x05c88
  - disasm:code+0x05b54
  - disasm:code+0x0e740
issue: 168
---

**There is no message box queue: only one box is ever open, and the code that opens a second one stops and waits until the first box's deadline has passed. The whole game waits with it. Then the first box is closed, its default answer pressed if it has buttons, and the second is opened. Boxes are therefore shown in the order they are raised.**
The message box routine, code+0x05be2, first tests the open box's width at data+0x502e. While a box is open it loops (code+0x05bfe) until the vblank count data+0x4fee reaches the box's deadline data+0x5032, a guard on the 16-bit count's wrap included. The loop keeps the pointer shown, scrolls the map if the pointer asks for it, and still reads keys (code+0x06414) and mouse clicks (code+0x06826), unless a fight is being set up (data+0x4ff0 1 to 4). A press that answers the open box clears its width and ends the wait early. Nothing else runs: no tick, no movement, no other window. After the loop the routine closes the box (code+0x05c8e). The close routine presses the default button, if there is one (code+0x05b54), as a timeout does, before the new box is drawn.

So a box without buttons is up for at least 200 frames, or 60 on Very Hasty, before a later box replaces it. A box with buttons is answered by its default when its deadline passes, unless the player answers it first. In practice game logic cannot raise a box while one with buttons is up, because the clock stops for those (code+0x0e740), and meetings, fights, pass-bys and War Events are all raised from ticks. The waiting case is a box raised while one without buttons, such as a War Event announcement or a pass-by message, is still inside its first 200 frames.

Some callers close the open box themselves before opening theirs, and so replace it at once without waiting: the combat window (code+0x10c12), a click on a Force or a Place (code+0x05682, code+0x058fe), and the X key (code+0x0665e), among others. The Council of Elrond's box waits on its own 1,200-frame loop instead (finding:ui-council-of-elrond-message).
