---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x187f2
  - disasm:code+0x18932
  - disasm:data+0x4d22
  - disasm:data+0x4d38
  - disasm:code+0x15d38
  - disasm:code+0x0d682
issue: 117
---

**The game draws all its text through one routine in the disk font lord/10, except on the hi-res Full Map Level, where the same routine uses the ROM font topaz/8.**
The text routine at code+0x187f2 draws into one RastPort at data+0x594a. On its first call it sets that RastPort up (code+0x18932): it opens topaz.font at size 8 with OpenFont, keeping it at data+0x4d4c, then opens diskfont.library and lord.font at size 10 with OpenDiskFont, keeping it at data+0x4d34. The two TextAttr records are at data+0x4d22 (lord.font, 10) and data+0x4d38 (topaz.font, 8). lord/10 is on Disk 1 as FONTS:lord.font and FONTS:lord/10 (finding:data-formats-lord-font-metrics); topaz/8 is in the Kickstart ROM, not on the disks.

Each call picks the font again: lord/10, or topaz/8 when the screen at data+0x57da is 640 pixels wide or more. The screen routine code+0x15d38 opens a 640 by 200 hi-res screen only for mode 1, which the Full Map Level asks for (code+0x0d682); the Campaign Level's 336 by 208 screen and the 320 by 200 Animation Level screen are lo-res. So Galadriel's Mirror and the other Full Map Level boxes are lettered in topaz/8, and every other window in lord/10.

The routine is given x and y for the top left of the text and a colour. It adds the font's baseline to y, then draws the text with the graphics library's Text, breaking the line at each carriage return or line feed and moving down by the font's height, 10 pixels for lord/10. It returns the height of what it drew in the high byte and the width of the last line in the low byte, halved on a hi-res screen; callers use that to size boxes. Callers that draw several lines themselves choose their own spacing: the info window's lines are 9 apart (finding:ui-window-frame-tiles).
