---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x0dba2
  - disasm:code+0x0dbe6
issue: 94
---

**If Elrond or Glorfindel is the Ring-bearer at the Council of Elrond, Gimli becomes the Ring-bearer, and Elrond and Glorfindel are put to sleep.**
When the Ring-bearer byte (data+0x3e6a) is 3, Elrond, or 4, Glorfindel, it is set to 12, Gimli (code+0x0dba2). Only the byte changes: the objects word of each entry is left as it was. Then the state of entries 3 and 4 is set to 0, asleep (code+0x0dbe6), whoever holds the Ring; their trigger bytes are kept.
