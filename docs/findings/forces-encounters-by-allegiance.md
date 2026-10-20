---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0f028
  - disasm:code+0x0f054
  - disasm:code+0x0f196
  - disasm:code+0x0f89a
  - disasm:code+0x0fb1e
issue: 81
---

**An Encounter figure's allegiance decides what meeting it does: Evil figures fight, allegiance 1 figures only pass by, and the allegiance 3 advisors stop to talk. No Encounter figure ever joins a Force.**
The search for Encounters runs inside the roster sweep (code+0x0f028). On the Campaign Level it runs only when the mover steps onto a tile origin. On the Animation Level it runs on every step. Evil movers never meet Encounters: their search stops at entry 79 (code+0x0f054). The area, day, chance and size tests (finding:forces-encounter-figures-wait-in-areas, finding:forces-folk-met-only-in-settlements) are rolled out of 50 on the Campaign Level and 100 elsewhere (code+0x0f196), and a chance of 0 still passes about one time in a hundred.

- **Allegiance 0**, the orcs, trolls, wolves, spiders, balrogs and the like: an attack (finding:combat-evil-encounters-attack).
- **Allegiance 1**, "a Ranger", "a dwarf", "a hobbit", "an elf", "a wanderer", "a traveler", "an old man" and the Rohirrim scouts: met only on the Animation Level by the watched Character (code+0x0f89a), except the scouts, met anywhere. They pass by (finding:forces-anonymous-encounters-pass-by).
- **Allegiance 3**, Círdan, Tom Bombadil, Bilbo, Galadriel, Treebeard and Radagast: an invitation to talk (finding:ui-encounter-talk-window).

No Encounter figure is ever moved or removed by a meeting.
