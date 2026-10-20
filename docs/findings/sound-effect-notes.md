---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x1796c
  - disasm:code+0x17a0e
  - disasm:code+0x17a34
issue: 132
---

**A sound effect is one note of its instrument on the fourth voice, held for four frames, or two for the second bell, and then released.**
The effect player (code+0x1796c; finding:sound-effects) stops voice 3, then picks a note and a time by the effect's slot (code+0x17a0e): Whoosh note 0x6c plus a roll of 4, Magic 0x6c, Sword 0x5c plus a roll of 4, ReverbBells in slot 4 note 0x3c, all for 4 frames, and ReverbBells in slot 5 note 0x40 for 2. Slot 0 would play 0x6c for 4 but holds no instrument. It starts the note on voice 3 at full velocity, 255 (code+0x17a34), waits the frames out, then releases the note and frees the voice. The game does nothing else while it waits.
