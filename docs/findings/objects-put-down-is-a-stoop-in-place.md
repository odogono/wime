---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06e3e
  - disasm:code+0x0c248
  - disasm:code+0x0c2a6
  - disasm:code+0x0c36c
  - disasm:data+0x095e
issue: 162
---

**Putting an object down sends the chosen Character's figure to script entry 0xde: it bends down where it stands, waits 25 to 49 frames, the object's picture appears at its feet with the "puts down" message, and it stands up again.**
The Put Down handler calls the figure at entry 0xde (code+0x06e3e) and shows nothing (finding:objects-put-down-message-after-the-animation). The entry is the same in every set, `a1 6d, 61, 82, a1 76, 84, bf`:

1. Call 0x6d: speed 10, then step 2 px right three times on three bending frames (6, 10, 11 for FRML 0, 2 and 14; 6, 9, 10 for the elf; 4, 10, 11 for the dwarf; 1, 12, 13 for the wizard; 12, 13, 14 for the small orc; 11, 12, 13 for FRML 6, 8 and 15). The other sets, the Ent, troll, warg, spider, balrog and rider, have no bending frames and only wait.
2. Wait 25 + random(25) frames.
3. Event 2 (code+0x0c248): unless six object pictures are already up, add the object's picture, IMAG 50 plus the object from BScene.res, with its top-left at the figure's x − 2 and y 161, at depth 0x95 and with button 0x99 plus the object (code+0x0c2a6), so it can be clicked like the ones placed with the scene (finding:objects-on-the-ground-drawn-when-the-scene-is-built). Then the message box "<name> puts down <object>." opens.
4. Call 0x76: the same frames in reverse, standing up.
5. Event 4 (code+0x0c36c) ends the order and wakes the party (finding:ui-provisions-window-holds-the-party), and the figure returns to the script it was running.

A figure that bends ends 6 px to the right of where it stood, since the bending steps forward and standing does not step back. Depth 0x95 puts the picture behind all the figures, whose rows start at 0x96.
