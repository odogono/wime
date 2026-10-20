---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0f8b0
  - disasm:code+0x0fba8
  - disasm:code+0x0fb74
  - disasm:code+0x083ec
  - disasm:code+0x08596
  - disasm:code+0x0fdda
issue: 81
---

**Meeting an advisor on the Campaign Level opens a two-line window, "FRODO meets TOM BOMBADIL." and "TOM BOMBADIL invites FRODO to pause and talk.", with "Go there" and "Continue on".**
The box is opened at x 88, y 5, 192 wide and 44 high (code+0x0f8b0), the lines at (10, 8) and (10, 18), and the buttons "Go there" at (16, 30) and "Continue on" at (110, 30) (code+0x0fba8). The verb takes an "s" for a single Character. Like the follow window (finding:ui-meeting-window), it stops the clock, defaults to "Continue on" after 720 frames, and holds both parties still while it is up (code+0x0fdda). "Go there" (code+0x083ec) watches the Character and goes down to the Animation Level for the talk. "Continue on" (code+0x08596) lets both walk on.

When the watched Character meets an advisor on the Animation Level, there are no buttons: a one-line "FRODO meets TOM BOMBADIL." box opens and the talk starts at once (code+0x0fb74).
