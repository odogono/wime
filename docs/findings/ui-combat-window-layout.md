---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x10bdc
  - disasm:code+0x10c48
  - disasm:code+0x10c66
  - disasm:code+0x101f2
  - disasm:code+0x102bc
  - disasm:code+0x10cf8
  - disasm:code+0x0524a
  - observed:combat-faramir-go-there
issue: 45
---

**The combat window's header reads "Charge Engage Wthdrw Retreat --Good----------" over the Good rows and "--Evil---------" over the Evil rows. Each Good row has four option buttons, with one message line below the rows.**
The window is 272 pixels wide. It is one line deep per row of the longer side, plus 32 pixels (code+0x10bdc). A line is 9 pixels, or 8 when a side is crowded (code+0x0524a). The Good header is drawn in colour 8, blue in play, and the Evil header in colour 10, red (code+0x10c48, code+0x10c66).

Each Good row has four small buttons at x 18, 47, 76 and 105, under the four option words, with Engage marked at the start (code+0x101f2, code+0x10cf8). Evil rows have no buttons. Good names start at x 130 and Evil names at x 200, and a follower's row is indented 5 pixels (code+0x102bc). The message line shows the opening "… move grimly into battle.", each loss in turn, and finally the result.

In play, with Faramir and his Rangers against orcs, the rows read "FARAMIR", "200 Rangers" and "444 orcs". This adds the layout to finding:ui-combat-window.
