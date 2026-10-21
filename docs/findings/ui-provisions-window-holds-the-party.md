---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x08340
  - disasm:code+0x0aa06
  - disasm:code+0x0c36c
  - disasm:code+0x0a5ce
issue: 162
---

**Opening the provisions window holds every figure of the watched Force still; script event 4, at the end of a Take or Put Down, clears the order under way and sets them moving again, each after its own short delay.**
After drawing the window's buttons the provisions case calls code+0x0aa06 with 0 (code+0x08340). With 0 it gives each figure of the Force's rows (data+0x548a) the wait 0xfffe, unless it has stopped for good (0xffff). The order's figure is then started at once by code+0x0a5ce, which clears its wait. Event 4 calls the same routine with 7 (code+0x0c36c): a non-zero argument clears data+0x08cd, the order under way (finding:ui-provisions-chosen-character), and gives every held figure a next update at the frame count plus its entry in data+0x5426. So the rest of the party stands while the Character fetches or puts down an object. How the party is released when the window is closed without an order was not traced; code+0x08ec2 calls the routine with 6 on another path.
