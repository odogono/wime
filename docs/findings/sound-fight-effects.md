---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x0bc72
  - disasm:code+0x0bcda
  - disasm:code+0x0bd4c
  - disasm:code+0x0c52c
  - disasm:code+0x0c5c0
  - disasm:code+0x0c5d4
  - disasm:code+0x0c63a
issue: 133
supersedes: sound-effects
---

**The game has four sound effects, all instruments: a bell, ReverbBells, as every message box opens; a whoosh or a sword whenever an Animation Level figure is drawn on frame 9 or 11; and magic when a figure's script casts a spell.**
The effect player (code+0x02116) plays instrument slot n of the table at data+0x5632, if sound is on, as one note (finding:sound-effect-notes). At start-up slots 4 and 5 get ReverbBells (code+0x0237c). When a fight starts and is not ignored, and only if there was memory to spare (finding:sound-full-arrangements-need-memory), slots 1 to 3 get Whoosh, Magic and Sword from Disk 2 (code+0x109ce; finding:sound-score-and-effect-table).

- ReverbBells, slot 4, as the message box routine shows a box (code+0x062ec), so with every window.
- ReverbBells, slot 5, from code+0x05550 and code+0x057fe, after a picture is copied into a box; what these boxes are was not traced.
- Whoosh or Sword, slot 1 or 3 at random, as an Animation Level figure is drawn on frame 9 or 11 of its set (code+0x0bd4c). The figure's record holds its frame in byte 3 and its set in byte 9 (code+0x0bcda, where the frame picks a 6-byte entry of the set's frame list), and only records of kind 3, figures, are drawn this way (code+0x0bc72).
- Magic, slot 2, when a figure's script runs event 0x10 (code+0x0c52c). The event clears the set-18 figures that have gone past x 320, spawns a set-18 figure, frame 0x17 or 0x0a by the event's argument, above the caster (code+0x0c5c0), and plays Magic (code+0x0c5d4, code+0x0c63a).
