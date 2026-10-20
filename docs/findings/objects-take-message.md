---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06b9c
  - disasm:code+0x06c22
  - disasm:code+0x06cf8
  - disasm:code+0x06d1a
  - disasm:code+0x0c1f4
issue: 105
---

**Choosing an object to take closes the list and shows "<name> goes to pick up <object>." in a box at (10, 5), 192 by 24, with the text at (10, 8) in colour 5 and no buttons; meanwhile the Character's figure walks to the object's picture, which then disappears.**
The handler marks an order as under way (data+0x08cd, code+0x06b9c), which keeps a second provisions order out (finding:ui-provisions-chosen-character). It records the x of the chosen Character's figure and finds the object's picture among the figures by its button number (code+0x06c22; finding:objects-lying-on-the-ground-are-pictures), then gives the Character's figure command 0xd4 (code+0x06cf8) through code+0x0a5ce, which queues a command for a Character's figures. The message (code+0x06d1a) lasts 200 frames like any box without buttons (finding:ui-war-event-messages). The figure's script (code+0x0c1f4) later moves the picture off the screen (to y 200). The changes to the slot and the objects word are made at once (finding:objects-take-from-the-ground); the script was not traced further.
