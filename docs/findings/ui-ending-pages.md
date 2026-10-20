---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0296c
  - disasm:code+0x02e64
  - disasm:code+0x02cd6
  - disasm:code+0x0305a
  - disasm:code+0x03186
  - disasm:code+0x063fc
  - disasm:code+0x02034
  - resource:BScene.res#CSTR 49
  - resource:BScene.res#CSTR 55
  - observed:ending-ring-at-mount-doom
  - observed:ending-ring-at-barad-dur
issue: 103
---

**Both endings leave the current Level for a closing scene on the Animation Level, show three pages of text in message boxes, then wait for the X key and quit the game.**
The losing ending (code+0x0296c) and the winning ending (code+0x02e64) share one shape. Each leaves the Level it is on, empties the watched Character, and enters the Animation Level with its own scene: the losing one places the view on Mount Doom, (1808, 1120), and loads the figure sets of the hooded figure, the orc with a shield, the balrog and the troll (FRML 8, 6, 12 and 9); the winning one places it on Hobbiton, (640, 368), and loads the man with a sword, the wizard, the dwarf and the elf archer (FRML 2, 4, 3 and 1; finding:graphics-animation-level-figure-sets).

Then three message boxes follow (code+0x02cd6, code+0x0305a). Each of the first two stays until a key is pressed or 1,050 frames pass, 21 seconds at 50 frames a second (code+0x02034):

| Ending | First page                                                     | Second page | Last page                                         |
| ------ | -------------------------------------------------------------- | ----------- | ------------------------------------------------- |
| lost   | CSTR 49 (the Ring at Barad-dûr) or CSTR 50 (three Strongholds) | CSTR 51     | CSTR 52, "YOU HAVE LOST THE WAR IN MIDDLE EARTH." |
| won    | CSTR 53                                                        | CSTR 54     | CSTR 55, "SO ENDS THE WAR IN MIDDLE EARTH."       |

The last page stays, ignoring every key but X and every click; X closes the game down and exits to the AmigaDOS prompt (code+0x03186, code+0x063fc). In play, space skipped a page at once and each page otherwise closed after about 21 seconds; the Hobbiton scene showed Gandalf, Aragorn and the Hobbits in a row, and the Mount Doom scene orcs, a troll and a balrog by the volcano. There is no way back into the game: no new game, no restore.
