---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x05408
  - disasm:code+0x0555e
  - disasm:code+0x176ae
  - disasm:code+0x0580a
issue: 196
---

**A pressed icon or button flashes before the press acts: six times, 4 frames apart, each time swapping every pixel of it between colour c and colour c XOR 8. The game stands still for those 24 frames. The magnifying glass flashes the icon of the Force it found four times the same way.**
The click routine flashes an object whose byte 4 has bit 0 set (finding:sound-reverb-bells-ring-on-a-press). A picture, such as an icon, is first copied into a spare object (code+0x05408 to code+0x05548); a plain button area is flashed on the screen itself. Six times, 4 frames apart, the routine then calls the blitter routine code+0x16d56 over the object's area with a plane mask of 8, and puts the copy back for a picture (code+0x0555e to code+0x0560e). That routine blits only the planes in its mask, with a minterm that complements them (code+0x176ae), so each call inverts bitplane 3: colour c becomes c XOR 8, swapping palette entries 0 to 7 with 8 to 15. Six calls leave the area as it was, so it shows swapped, plain, swapped, plain, swapped and plain. The routine waits on the vblank count between calls and returns only when all six are done, so nothing else happens meanwhile, and only then is the press acted on.

When the magnifying glass finds Forces near its spot, it flashes the first row's Force the same way four times: a 16 by 16 area at the Force's position less the camera, 4 pixels higher (code+0x0580a to code+0x0587c).
