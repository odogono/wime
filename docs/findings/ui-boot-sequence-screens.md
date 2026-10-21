---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x02142
  - disasm:code+0x0223e
  - disasm:data+0x092e
  - disasm:data+0x08e6
  - disasm:data+0x08ee
  - resource:ATitle.res#IMAG 70
  - resource:ATitle.res#IMAG 71
  - resource:ATitle.res#IMAG 72
  - resource:ATitle.res#IMAG 73
  - observed:animation-level-opening
  - observed:boot-sequence-timing
issue: 145
---

**The boot sequence shows four ATitle.res pictures on a timetable counted in frames from when Title starts: the Melbourne House screen at frame 0, the Synergistic screen at 240, the title screen at 540 and its logo at 600. With memory to spare the Credits follow at frame 1000; then the Ring verse.**
The start-up routine (code+0x02142) loads ATitle.res, AText.res and AMaps.res, makes still pictures of ATitle.res IMAG 70 to 73, loads the title palette (finding:graphics-title-screen-palette), starts Title (finding:sound-title-music-in-the-boot-sequence) and sets the frame count to 0. A loop (code+0x0223e) then waits for each time in the word table at data+0x092e, 0, 240 and 540, and draws one picture. Before the Synergistic screen and the title screen it fades the last one out, and after each it fades the new one in (finding:graphics-boot-screens-fade):

| Frame | Picture             | Shown                                                                                                        |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0     | IMAG 70, 119 by 141 | at (92, 22): the Melbourne House globe and "PRESENTS"                                                        |
| 240   | IMAG 71, 216 by 92  | at (44, 41), after clearing the screen: "A Synergistic Software product"                                     |
| 540   | IMAG 72, 320 by 200 | over the whole screen: the title screen's painted backdrop                                                   |
| 600   | IMAG 73, 226 by 153 | at (48, 20), over IMAG 72: the logo, "War in Middle Earth, based on the Lord of the Rings by J.R.R. Tolkien" |

The positions come from the word tables at data+0x08e6 (x) and data+0x08ee (y); the logo's from code+0x023dc. The next waits come from the same table: 600 (data+0x0934) for the logo and 1000 (data+0x0936) before the Credits (finding:ui-boot-credits-scroll). The Credits run only when the start-up memory flag at data+0x4ff1 is set (finding:sound-full-arrangements-need-memory). Without it the game draws the logo at 600, waits until frame 2600 (data+0x0938) and goes on to the Ring verse (finding:ui-ring-verse-window). At 50 frames a second the Melbourne House screen stays about 5 seconds, the Synergistic screen 6, and the title screen with its logo 9 before the Credits begin. A key ends the sequence early (finding:ui-boot-sequence-key-skips).

In FS-UAE the pictures were ready to fade in at frames 1, 273 and 572: each fade-out takes about 30 frames after the scheduled time. Under WHDLoad the memory flag was clear, with 1 MB or 2 MB of chip memory, so the Credits were skipped; the logo was drawn at frame 676 and the Ring verse at 2810. With the flag set by hand, building the Credits' bitmap before the logo's wait delayed the logo to frame 789, and the Credits began at frame 1000.
