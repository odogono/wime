---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - resource:AMaps.res#IMAG 100
  - disasm:data+0x1de8
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 9
---

**The Campaign Level icon sheet is AMaps.res IMAG 100, an 80 by 96 picture of thirty 16 by 16 icons in five columns and six rows; in that file, a roster entry's icon byte `0xRC` sits at column R, row C.**
Finding:graphics-campaign-icon-index traced the drawing code to a runtime sheet at data+0x5020, laid out 16 icons wide with the byte's low four bits as the column and the high four as the row, but did not trace which resource the sheet comes from. IMAG 100 is the same pictures stored transposed: read as column = high nibble, row = low nibble, every one of the thirty icon bytes used in the roster lands on the right picture. The figures are byte 0x00 (Aragorn, Legolas), 0x01 (Boromir), 0x02 (the Hobbits and Gimli), 0x03 (the Wizards) and 0x04 (Gollum); 0x05 is the Gondor tree on a heraldic shield (Faramir, Denethor, the tower guards). Column 1 is Gondor's blue shields, column 2 Rohan's green (0x20 the horse's head of its cavalry), Dale and the Dwarves (0x25 the axe), column 3 the Elves' bow (0x30), the Nazgûl (0x31, 0x32), Saruman's White Hand (0x33), the Dunlendings' plain wooden shield (0x34) and the Easterlings (0x35), and column 4 the other Evil peoples: Wainriders, Haradrim, Southrons, the trolls' club (0x43), the Orcs' scimitar (0x44) and the Corsairs' sail (0x45). These match the shields and weapons the manual lists (finding:graphics-unit-badge-nation-shields, finding:graphics-unit-badge-weapons). How the game builds its transposed runtime sheet from the resource has not been traced, and the port reads the resource's own layout.
