---
kind: fact
topic: ui
confidence: documented
sources:
  - manual:pdf-p4
  - disasm:code+0x02394
  - disasm:code+0x027ce
issue: 244
---

**The original has no Demo mode: it never plays itself, at the title or anywhere else.**
The manual's Loading the Game page (pdf-p4) only says how to start the game on each machine, and its key list, on the same page, has no key for a demonstration. No other page of the manual mentions a demonstration, an attract mode or the game playing by itself. The boot sequence does not wait at a title for input: once its screens and the Ring verse have run, or a key has cut them short, the game goes straight on to loading the first Animation Level of a new game (code+0x02394, code+0x027ce; finding:ui-boot-sequence-screens, finding:ui-boot-sequence-key-skips). There is no idle point at which a Demo could begin, and none of the other Findings records one. The port's Demo mode is its own addition (docs/spec/demo-mode.md).
