---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0b48c
  - disasm:code+0x0b4a0
  - disasm:code+0x0b4ee
  - disasm:code+0x0b1e8
  - disasm:code+0x0af18
  - disasm:code+0x0c3f6
  - disasm:code+0x0c4ea
  - disasm:code+0x0c37e
  - disasm:code+0x0b622
  - disasm:code+0x0b6c0
  - disasm:code+0x09f60
  - disasm:code+0x08eb2
  - disasm:code+0x0b29a
  - disasm:data+0x095e
issue: 169
---

**An advisor's talk on the Animation Level is paced by the advisor's figure script: it walks up to the party, opens the first box, gestures a while, opens the second and walks off left, and the party walks on. Only the second box can be clicked away.**
When the watched Character meets an advisor (fightState 4, code+0x0b48c), the party's battle line is set to 70, or to 160 if the rightmost Good figure already stands at 70 or more (code+0x0b4a0; data+0x5608 holds that figure's x, code+0x0b1e8), and the advisor's line 100 beyond it (code+0x0b4ee). After "Go there" from the Campaign Level the lines are 70 and 150 (code+0x0af18). The party walks to its line (script entry 0xa0), stands 750 to 1,499 frames (entry 0x54) and walks on (entry 2). The advisor enters mirrored from the right and runs entry 0xb8, walking left to its line, then entry 0xe6.

From 0xe6 the walking advisors' scripts (FRML 0 to 3, 7, 14 and 15, at data+0x095e) wait 50 to 99 frames; event 3 then stops the party where it stands, and event 0x0c opens the first box (code+0x0c3f6; finding:ui-advisor-talk-has-two-boxes). The advisor gestures, between frames 6 and 0, with waits of 25n plus random(25n) frames, repeating each time a roll of 50 in 100 passes, and waits twice more; event 0x0d then opens the second box and sets the advisor's line to −50 (code+0x0c4ea). Event 5 sets the party walking again from entry 2 (code+0x0c37e), and after 75 to 149 frames the advisor returns to entry 0xb8 and walks left off the screen.

The "FRODO meets TOM BOMBADIL." box stays until the first box replaces it. A click on a box is ignored while fightState is 4 (code+0x08eb2), so neither it nor the first box can be clicked away; the second box, opened after fightState is cleared, closes on a click or after the Animation Level's 1,500 frames (finding:ui-message-box-timeouts-by-level). The roster sweep, and so the clock, does not run while the talk's data+0x5562 is set (code+0x0b29a).

Círdan, Galadriel and Tom Bombadil, whose figure byte is 20 or more, appear as still pictures (fightState 7), placed at x 158 with their foot at y 174: the picture's x field takes 0x9e and its y is 174 less its height (code+0x09f60). The party walks to its line as before, and when it has arrived (data+0x555f) the first box opens (code+0x0b622); the second opens 600 frames later (code+0x0b6c0). No event holds the party, so it stands its 750 to 1,499 frames and walks on.
