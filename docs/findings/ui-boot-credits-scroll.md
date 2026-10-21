---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0240e
  - disasm:code+0x02456
  - disasm:code+0x02536
  - disasm:data+0x08f6
  - disasm:data+0x0904
  - disasm:data+0x0912
  - disasm:data+0x0920
  - resource:AText.res#CSTR 59
  - resource:AText.res#CSTR 60
issue: 145
---

**The Credits scroll up over the title screen, one pixel every 3 frames for 600 steps, about 36 seconds: AText.res CSTR 59 holds the roles and CSTR 60 the names, drawn in pale yellow with a dark outline in a 160-pixel column at x 84. The logo scrolls up off the top with them.**
At frame 1000 of the boot sequence (finding:ui-boot-sequence-screens) the routine makes a 160 by 400 bitmap (code+0x0240e) and draws the two texts into it, each seven times (code+0x02456) from the byte tables at data+0x0912 (CSTR id), data+0x08f6 (x), data+0x0904 (y) and data+0x0920 (colour). Six copies in colour 2, at offsets (0, 0), (1, 0), (0, 1), (1, 2), (2, 1) and (2, 2), make the outline, and a seventh in colour 1 at (1, 1) the letters (finding:graphics-title-screen-palette). The roles start at x 0 and the names at x 94, so each name sits beside its role on the same line, one role to several names: "Produced by" Ron Harris, "Directed by" Robert Clardy, "Game Design" Alan B. Clark and Robert Clardy, and so on, down to "Characters, locations, and events used by permission of the Tolkien estate." and "Copyright (c) 1988 Melbourne House".

Each step (code+0x02536) waits 3 frames and redraws the column with its top at y 200 minus the step, copying the title screen back behind it, so the Credits rise from the bottom of the screen. From step 16 the logo is redrawn at y 35 minus the step, rising with them from its place at y 20. The loop ends after 600 steps, or as soon as a key is waiting; it looks at the key without taking it. The Ring verse follows (finding:ui-ring-verse-window).
