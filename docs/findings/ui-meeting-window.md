---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0f8b0
  - disasm:code+0x0fc18
  - disasm:code+0x0fdc0
  - disasm:code+0x0fe42
  - disasm:code+0x06318
  - observed:forces-meet-mobilised-characters
  - observed:forces-meet-mobilised-units
  - observed:forces-meet-an-advisor
  - observed:forces-meet-an-unmobilised-leader
issue: 68
---

**A meeting opens a two-button window at the top of the Campaign Level: "<A> meets <B>.", then a second line and the buttons. The clock stops until it is answered, and after 720 frames, about 14 seconds, it answers "Continue on" by itself.**
In play:

- Two mobilised Characters: "FARAMIR meets EOMER." / "EOMER welcomes FARAMIR to join.", with "Follow EOMER" and "Continue on".
- Two Units: "1000 infantry meet 800 infantry." / "Infantry welcome the infantry to join.", with "Follow infantry" and "Continue on". A Unit is named with its head count and takes the plural verb. In the second line the welcoming Unit's name is capitalised and the joining one gets "the".
- An advisor: "ARAGORN meets ELROND." / "ELROND invites ARAGORN to pause and talk.", with "Go there" and "Continue on".
- An unmobilised Leader: "FARAMIR meets THEODEN.", a single line, with "Go there" and "Continue on".

The text pieces are code strings: " meet", "s", " welcom", "e"/"es", " to join.", "Follow ", " invites ", " to pause and talk.", "Go there" and "Continue on" (code+0x0ff17 to code+0x1002f). The window is the message box with buttons (code+0x0f8b0). Its arguments are 88, 5, 192 and 24, presumably position and size, with 20 more of height when there is a second line. The left button's arguments are 16 and 30, and "Continue on"'s 110 and 30, presumably within the box. The captures match: a box at the top centre-right, the buttons on its last line.

"Continue on" is the default every time (code+0x0fdc0, code+0x0fe42). A window with buttons sets its deadline 720 frames ahead on the Campaign Level, 1,020 on the Animation Level (code+0x06318), and stops the clock until then (finding:ui-war-event-messages). Offering to follow also stops both Leaders (state 2) while the window is up. The other kinds leave them as they were.
