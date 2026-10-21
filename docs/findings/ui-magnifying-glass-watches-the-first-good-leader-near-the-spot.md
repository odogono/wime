---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x07f84
  - disasm:code+0x05766
  - disasm:code+0x05882
  - disasm:code+0x06826
  - disasm:code+0x068e4
  - disasm:code+0x028fc
  - disasm:code+0x04dde
  - observed:animation-level-frodo-from-the-glass
issue: 160
---

**The Campaign Level's magnifying glass watches the first Good row of the Forces near the spot clicked: the lowest-numbered awake Good Leader within reach, not the Force nearest the pointer. If there is no such Character there, the Animation Level shows the spot itself with nobody watched.**
Clicking the glass arms it (data+0x5557 set to 1, code+0x07f84). The next click on the map lists the Forces near the spot with the routine that also gathers a fight's rows (code+0x05766, code+0x04dde; finding:combat-rows-merge-like-named-forces). Its Good rows are awake Leaders taken in roster order, so the first row is the lowest-numbered one in reach, whichever is nearest. When there are rows, the first row's icon flashes four times; then, if the first row is roster entry 1 to 78, it becomes the selected Character (data+0x5559), and otherwise the selection is cleared (code+0x05882). With no rows at all, the selection is cleared too.

The glass then sets the go-down button (code+0x06826). If no Character was selected, it first puts the empty roster entry 0 at the clicked spot, rounded down to 16 pixels (code+0x068e4). The main loop goes down watching the selected Character, or entry 0 (code+0x028fc). With entry 0 watched, the Animation Level never calls the tick (finding:time-animation-level-holds-the-sweep-at-the-watched-character). So an Evil Force under the glass, with no Good Leader in reach, is not watched. A follower is never chosen itself: its Leader is.

In FS-UAE the glass, clicked between Frodo at (640, 384) and a Nazgûl at (630, 390), went down watching Frodo (entry 7), and data+0x5559 held 7. The empty-spot case was read from the code only.
