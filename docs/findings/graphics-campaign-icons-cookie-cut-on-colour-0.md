---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x0d2e8
  - disasm:code+0x16398
  - disasm:code+0x16ef6
  - disasm:code+0x18308
  - disasm:code+0x1843c
issue: 200
---

**A Campaign Level icon is cut onto the map with a mask made from its own planes: every pixel of colour 0 lets the map show through, and every other colour covers it. The icon's top-left corner is drawn at the Force's position, 4 pixels higher.**
The icon loop (code+0x0d2e8) blits a 16 by 16 cell of the icon sheet through the game's general image blit (code+0x16398). Before each blit, code+0x18308 ORs all the source planes together with the blitter (minterm 0xFE over planes 0 to 2, then again with planes 3 and, for a 5-plane image, 4) into a one-plane mask at data+0x580c. The blit itself (code+0x16ef6) then copies each plane with minterm 0xCA, taking the icon where the mask is set and keeping the map where it is clear. There is no stored mask and no other transparent colour. The icon is placed at the Force's x and at its y less 4, relative to the scrolled view, and is skipped when it falls wholly outside the 320 by 196 map area.

The same blit serves every image the game draws. An image whose bitmap has its flag byte (offset 2) set is first mirrored left to right (code+0x1843c), each byte through a bit-reversal table (data+0x5810), so one picture can face both ways.
