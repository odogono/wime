---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x084d6
  - strings:0x091b9
issue: 68
---

**After any "Follow", if Gollum's chain of Leaders now ends at a Wizard, "GOLLUM quietly sneaks away.": he stops following and becomes a Force of his own where that Wizard stands.**
The Follow handler then walks the chain up from Gollum, entry 78, and tests the top's Animation figure byte for 4, the Wizard (code+0x084d6). If it matches, it shows the message, gives Gollum the top's position and facing, and clears his Leader byte. This has not been played.
