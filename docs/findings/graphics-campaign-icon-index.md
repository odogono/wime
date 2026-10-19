---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x0d2e0
  - disasm:data+0x1de8
issue: 5
---

**Byte 18 of a roster entry picks its 16 by 16 Campaign Level icon from a sheet laid out 16 icons wide: the low four bits are the column and the high four bits the row.**
The Campaign Level copies the icon from (column × 16, row × 16) of a sheet held at data+0x5020 to the Force's position (code+0x0d2e0). Which resource the sheet comes from has not been traced. The icons group by row: row 0 holds the Characters' figures, rows 1 and 2 Gondor's and Rohan's shields, row 3 the Elves, Dwarves, Dale, the Nazgûl, Saruman's armies and the Easterlings, and row 4 the other Evil peoples. Units of one Nation and weapon share an icon; for example, all of Rohan's cavalry use 0x20 and all of Mordor's Orcs 0x44. This matches the shields and weapons in finding:graphics-unit-badge-nation-shields and finding:graphics-unit-badge-weapons.
