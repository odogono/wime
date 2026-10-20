---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x080e8
  - disasm:code+0x08256
  - disasm:code+0x082ac
  - disasm:code+0x08330
  - disasm:code+0x0aa06
  - disasm:code+0x0e740
issue: 105
---

**The provisions icon opens a box at (168, 5), 112 by 68, headed "Would <name> like to..." and offering three framed buttons, "Put down an object", "Take an object" and "Use an object". It has no Cancel: it closes itself after 1,020 frames, and the clock and the party's figures stand still while it is open.**
Button 0xf9 (finding:ui-animation-level-icons) is ignored during a fight; otherwise its case (code+0x080e8) closes any open box, picks the Character (finding:ui-provisions-chosen-character) and opens the box with an empty text (code+0x08256). The heading is drawn at (10, 8) in colour 8. The buttons are drawn at x 20 and y 22, 37 and 52, in colour 5 with a frame (code+0x082ac; finding:ui-message-box-text-colour), as buttons 0xbf, 0xc0 and 0xc1; each opens its list (finding:ui-object-list-window).

The box is shown with 0xb4 as its default button (code+0x08330), so after 1,020 frames on the Animation Level button 0xb4 is pressed for the player (finding:combat-unanswered-announcement-ignores-the-fight). Button 0xb4 just closes the box and lets the figures walk on (code+0x08eac). The showing routine also gives the box's own picture the button number 0xb4 (code+0x0617c), presumably so that clicking the box closes it. While a default button is set the clock does not advance (code+0x0e740). Opening the box also halts the walking figures of the Force on screen (code+0x0aa06 with 0).
