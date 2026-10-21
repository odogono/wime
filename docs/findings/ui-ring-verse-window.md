---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x02708
  - disasm:code+0x0272a
  - disasm:code+0x027b6
  - resource:AText.res#CSTR 57
  - resource:AText.res#CSTR 58
  - observed:animation-level-opening
issue: 145
---

**The Ring verse is shown in a window at (40, 20), 240 by 120, on a black screen, in two parts: AText.res CSTR 57, the first five lines, at (20, 20) and CSTR 58, the last three, at (20, 70), both in brown. It stays up while the first Animation Level loads.**
After the Credits, or the logo when there are none (finding:ui-boot-sequence-screens), the game clears the screen to colour 0 (code+0x02708) and opens a message box with no text and no buttons at (40, 20), 240 by 120 (code+0x0272a; finding:ui-window-box-geometry). It draws CSTR 57 at (20, 20) and CSTR 58 at (20, 70) into the box in colour 5 of the title palette (finding:graphics-title-screen-palette), shows it and puts it on screen. CSTR 57 holds "Three Rings for the Elven-kings under the sky," to "In the Land of Mordor where the Shadows lie.", with the second and fourth lines indented three spaces; CSTR 58 holds "One Ring to rule them all, …", its first two lines indented, and the closing "In the Land of Mordor where the Shadows lie." Ten-pixel lines (finding:ui-text-font-lord-10) put the five lines of CSTR 57 above y 70. The verse has no title line.

The game then clears the message box's deadline (code+0x027b6), so the window does not hold back Gandalf's letter (finding:ui-gandalfs-letter), takes any waiting keys and loads ASCENE.RES, AANIMS.RES and BSCENE.RES while the verse is on screen. `provisional`: it stays until the Animation Level's first picture replaces it, after Title ends (finding:sound-title-music-in-the-boot-sequence); the screen update has not been traced. In play, mouse clicks did not move past the verse and a key press did.
