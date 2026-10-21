---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0b590
  - disasm:data+0x08cf
  - resource:BScene.res#CSTR 56
  - observed:animation-level-opening
  - observed:boot-sequence-timing
issue: 145
---

**Gandalf's letter, BScene.res CSTR 56, is shown once, in a message box at (10, 5), 256 by 112, without buttons, over the first Animation Level while Frodo, Sam and Pippin walk across the bridge. Like any box without buttons on the Animation Level it closes by itself 1,300 frames after its 200-frame deadline, 30 seconds in all.**
The flag at data+0x08cf is 1 in the data hunk. Each pass of the Animation Level loop tests it (code+0x0b590); while it is set the loop opens the box with CSTR 56 in colour 5 (finding:ui-message-box-text-colour), shows it and clears the flag, and nothing sets it again. The box is moved to x 8 (finding:ui-window-box-geometry) and is drawn in the Animation Level palette, so colour 5 is 0x466 (finding:graphics-animation-level-palette). With no buttons, it sets no default answer and a deadline 200 frames after it opens, or 60 when the clock limit is 0 (finding:ui-war-event-messages). The Animation Level loop closes it 1,300 frames after that deadline (finding:ui-message-box-timeouts-by-level); the figures go on walking underneath.

The text, in nine lines, is "Dear Frodo," and Gandalf's warning: bad news has reached him and he must go, Frodo should leave at once for Rivendell, a friend of his called Strider may meet him on the Road, signed "Yours in haste GANDALF.", with a postscript that the servants of the Enemy have taken the guise of riders in black and must be avoided. In play the letter showed in a framed window over the opening scene and the three Hobbits walked off the right edge after it closed (finding:ui-animation-level-figures-walk-off). In FS-UAE the letter opened at frame 3575 with its deadline at 3775, 200 frames later. In another boot its deadline was frame 640, it was still up at 1298 and gone by 2284. `provisional`: whether loading an archive sets the flag again was not traced.
