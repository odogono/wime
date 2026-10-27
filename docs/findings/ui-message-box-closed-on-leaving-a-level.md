---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0ce92
  - disasm:code+0x0d6e2
  - disasm:code+0x065ea
  - disasm:code+0x053c2
issue: 168
---

**Leaving the Campaign Level or the Full Map Level closes the open message box and presses its default answer. The Full Map Level cannot be entered while a box with buttons is up, so a meeting or a fight's announcement never waits there.**
The main loop runs each Level's loop between an enter and a leave routine (code+0x028e2 to code+0x02918). The Campaign Level's leave routine starts by closing the box (code+0x0ce92), and so does the Full Map Level's (code+0x0d6e2). Closing presses the default button, if any (code+0x05b54).

While a box has a default button, the click test ignores the icons with ids 0xf1 to 0xf8 (code+0x053c2), which include the Full Map icon, 0xf6. The U key, which also sends 0xf6, is ignored too (code+0x065ea). A box without buttons, such as a War Event announcement or a pass-by message, closes when the player goes to the Full Map Level. Since time stands still there (no tick runs in its loop), nothing raises a new box until the player returns.
