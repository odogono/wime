---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0299e
  - disasm:code+0x02a28
  - disasm:code+0x02c0c
  - disasm:code+0x02cb2
  - disasm:code+0x02cd6
  - disasm:code+0x02e96
  - disasm:code+0x02f3a
  - disasm:data+0x093a
  - disasm:code+0x16798
issue: 107
---

**The scenes behind the end pages are still pictures: the Animation Level's scenery on Mount Doom or Hobbiton with figure frames copied onto it once. Nothing in them moves, and the winning one never shows its dwarf.**
Each ending puts roster entry 0, the empty one, at (1808, 1120) to lose or (640, 368) to win and enters the Animation Level watching it, so the scene is built from that place, that entry's facing and the current hour (code+0x0299e, code+0x02e96). Its four figure sets are loaded through `newFigure`, but the picture is drawn by the bitmap copy at code+0x16798, which takes a frame's top left corner, its width and height, a flip flag and whether the set has 4 planes, and puts it on the screen bitmap with no hot spot. Then the Level is left (code+0x02cb2): the icons and figures go, and the picture stays under the message boxes.

- **Lost** (code+0x02a28): for rows y 106, 114, 122 and 130, an orc with a shield (FRML 6) every 30 pixels from x −20 to 310, each frame 13 less a roll of 4, flipped on a roll of 2, moved down by a roll of 7 and right by a roll of 25. After row 114 a troll (FRML 9, frame 11) at (18, 90) and a balrog (FRML 12, frame 1, flipped) at (240, 83); after row 122 a troll (frame 8) at (2, 95). Then nine hooded figures (FRML 8, frame 13) from x 10 to 274, 33 apart, at y 140 plus a roll of 10, x plus a roll of 15, flipped on a roll of 2 (code+0x02c0c).
- **Won** (code+0x02f3a): nine figures from x 245 down to 45, 25 apart, at y 140 plus a roll of 10, x plus a roll of 7. The tables at data+0x093a, data+0x0943 and data+0x094c give, from the left, each one's set, frame and rise above the line: a dwarf (FRML 3, frame 17), a hobbit (0, 16), an elf (1, 15, up 10), a hobbit, a wizard (4, 15, up 26), a man (2, 16, up 12), two hobbits and a man (2, 16, up 10). The five on the right are flipped to face left. FRML 3 has only 17 frames, so entry 17 is read from past the end of its frame list as a frame of width 0, and the dwarf is not drawn. This matches the scene seen in play, Gandalf, Aragorn and the Hobbits in a row (finding:ui-ending-pages).

The scene is shown alone for 300 frames, or until a key is pressed (code+0x02cd6), before the first page. Each page is a message box at (30, 10), 240 by 80, with its text from (20, 10) inside it (code+0x02cea, code+0x02d1e).
