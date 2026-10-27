---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0b590
  - disasm:code+0x0b5c8
  - disasm:code+0x08be0
  - disasm:code+0x08d12
issue: 171
---

**Restoring the Archive never brings Gandalf's letter back: its flag is set only in the data hunk at start-up, cleared once the letter shows, and lies outside what the Archive saves.**
The letter's flag, data+0x08cf, is read by the Animation Level loop (code+0x0b590) and cleared there once the letter is shown (code+0x0b5c8); no other code reads or writes it (finding:ui-gandalfs-letter). The Archive saves and restores data+0x1de8 to data+0x3e71 (code+0x08be0, code+0x08d12), which leaves the flag out. Since the game opens on the Animation Level, the letter has always shown before the player can reach the Archive, so a restored game, like a continued one, never shows it again until the program is started anew.
