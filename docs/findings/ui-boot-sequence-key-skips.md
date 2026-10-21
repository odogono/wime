---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x02034
  - disasm:code+0x0235c
  - disasm:code+0x02394
  - disasm:code+0x026c6
  - disasm:code+0x027ce
  - disasm:code+0x02830
  - observed:animation-level-opening
issue: 145
---

**Each screen of the boot sequence gives way to the next on a timer, not a click. A key pressed before the title screen's logo skips the rest, the Credits and the Ring verse included; one pressed while the logo shows skips the Credits; one pressed during the Credits ends them. Q also switches sound off.**
Every wait in the boot sequence (finding:ui-boot-sequence-screens) goes through code+0x02034, which waits for a frame count or a key, whichever comes first. A waiting key is taken; Q, either case, also flips the sound flag (finding:sound-q-toggles-sound). The routine returns whether a key came, and the boot sequence keeps that answer:

- Before frame 600, while the Melbourne House screen, the Synergistic screen or the bare title screen shows, a key ends the picture loop (code+0x0235c). The game then frees the pictures and goes straight to loading the Animation Level (code+0x02394, code+0x027ce): no logo, no Credits and no Ring verse.
- From frame 600 to 1000, while the logo shows, a key skips the Credits: the loop that runs them tests the kept answer first (code+0x026c6), and the Ring verse is shown.
- During the Credits the loop only looks for a waiting key without taking it, so a key ends them but is not kept; the Ring verse is shown and the key is taken with any others after it (code+0x027e2).

The kept answer also decides whether the game waits for Title to end before the first Animation Level (code+0x02830; finding:sound-title-music-in-the-boot-sequence). The waits test only the key routine (code+0x17ce2), and in play mouse clicks did not move past the Ring verse.
