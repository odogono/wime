---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x0f5a0
  - disasm:code+0x0f692
  - disasm:code+0x126d6
  - disasm:code+0x1276a
  - disasm:code+0x02224
  - disasm:code+0x02830
  - disasm:code+0x02cb6
  - disasm:code+0x03046
  - disasm:code+0x0312e
issue: 131
---

**ToWar.Moria announces a fight, ShortVictory or ShortDefeat follows it, the title music plays at start-up, LongMajorEvil plays over the losing scene, and ToWar.Moria then UltVict over the winning one.**
Each is asked for (finding:sound-score-and-effect-table) and played at once:

- A fight: when the fight announcement opens, ToWar.Moria, from Disk 1 or, on the Animation Level, Disk 2 (code+0x0f692). On the Animation Level it plays as soon as the watched Character is in the fight (code+0x0f5a0).
- Its end: if Good still has strength, ShortVictory, otherwise ShortDefeat, each from Disk 1 or on the Animation Level Disk 2 (code+0x126d6, code+0x1276a). An ignored fight has no music at its end.
- Start-up: Title, as the Animation Level is set up for the first time (code+0x02224). The game waits until it finishes or a key is pressed, then frees it (code+0x02830).
- Losing: LongMajorEvil once the losing scene is drawn (code+0x02cb6; finding:ui-ending-scenes-are-still-pictures).
- Winning: ToWar.Moria once the winning scene is drawn (code+0x03046), then, after the pages, UltVict with the last box (code+0x0312e).

On Disk 1 the lighter or full arrangement plays as finding:sound-full-arrangements-need-memory says.
