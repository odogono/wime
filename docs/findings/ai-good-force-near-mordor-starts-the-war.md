---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0efd0
  - disasm:code+0x0efec
issue: 45
---

**Any non-Evil Leader stepping onto a tile origin at or beyond (1664, 1008), the approaches to Mordor, sets War Event 7 at once, so "The Dark Lord's armies march forth!" can come early.**
This is the setting of bit 7 that finding:ai-war-events attributed to untraced battle code. It is in the movement step, not the fight code (code+0x0efd0). It records the day like the other events (code+0x0efec). The daily check then sets bits 3, 4 and 6 from bit 7 (finding:ai-war-events), so the whole war starts. The area takes in the Morannon, Minas Morgul, Cirith Ungol and every Place of Mordor beyond them, Mount Doom included, but not Dagorlad just north of the Morannon.
