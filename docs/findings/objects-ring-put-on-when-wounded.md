---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x10a26
  - disasm:code+0x1200a
  - disasm:code+0x12058
  - disasm:code+0x12c92
  - disasm:code+0x12cc6
issue: 45
---

**A Ring-bearer wounded in a fight fought on the Animation Level cannot resist the Ring: "Unable to resist, <name> puts on the Ring." The bearer vanishes, is protected until the fight ends, and then "suddenly reappears!".**
The Ring is put on when the bearer is wounded by the enemy's left-over blows in a fight on the Animation Level (code+0x1200a). The figure is moved out of sight and a flag set (code+0x12058). While the flag is set the Ring counts as magic protection (finding:combat-magic-weapons-and-protection). If the bearer survives, the message "<name> suddenly reappears!" is shown and the figure brought back (code+0x12cc6). The flag is cleared at the start of every fight (code+0x10a26), so the Ring is never on in a fight the player ignored.
