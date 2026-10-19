---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0d036
  - disasm:code+0x10bd2
  - disasm:code+0x116d6
  - disasm:code+0x123d0
  - disasm:code+0x1281c
  - disasm:code+0x129e0
  - disasm:code+0x12a0c
  - observed:combat-calembel-ignored
  - observed:combat-east-emnet-ignored
  - observed:combat-eomer-dies-ignored
issue: 45
---

**An ignored fight is fought to the end at once, with no combat window and every row on both sides on Engage. Only the result is shown, followed by a message for each Character who died.**
The Campaign Level loop runs the same combat code as for a watched fight (code+0x0d036). In an ignored fight it skips the window, the opening message, every casualty message and every pause (code+0x10bd2, code+0x116d6, code+0x123d0). No option can therefore be changed, and the Ring is never put on (finding:objects-ring-put-on-when-wounded). The arithmetic is otherwise the same.

The result appears in a message box: "The good forces are victorious!" or "The forces of EVIL have won." (code+0x1281c). Each Character who died then gets a box of their own (code+0x129e0). A Nazgûl, entries 79 to 87, or a Balrog, entries 183 to 187, "has been driven from the field."; anyone else "has died in combat." (code+0x12a0c). Both are recorded the same way. A destroyed Unit gets no message.

In play, 1,000 Gondor infantry beat 500 orcs at Calembel and "The good forces are victorious!" appeared. Later, 178 orcs killed Éomer: "The forces of EVIL have won." was followed by "EOMER has died in combat.".
