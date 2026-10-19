---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0f1c0
  - disasm:code+0x0f1dc
  - disasm:code+0x0f1fe
  - disasm:data+0x4242
issue: 45
---

**Encounters with a fighting strength of 1 or less are met only at settlements and on roads: always on a tile rated 100, half the time on a tile rated 80 to 99.**
After the area, day and chance tests (finding:forces-encounter-figures-wait-in-areas), an Encounter whose byte 23 is above 1 is met at once. Any other needs the terrain value of the tile (code+0x0f1dc) to be 100, or 80 to 99 with a further one-in-two roll (code+0x0f1fe). Town tiles and roads are rated 100. Castle, ruin and citadel tiles are rated 80. The figures this applies to include "a dwarf", "a hobbit", "an elf", "a wanderer", "a traveler", "an old man", the Dead Men and two bands of orcs.
