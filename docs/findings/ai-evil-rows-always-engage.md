---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x10a30
  - disasm:code+0x10c88
  - disasm:code+0x105c6
  - disasm:code+0x12472
issue: 45
---

**The Evil side never chooses an option: every Evil row stays on Engage until it is destroyed.**
Every row is set to Engage when the fight starts (code+0x10a30). Only Good rows get option buttons (code+0x10c88). Only clicks change options (code+0x105c6), and the end of each round revisits only Good rows (code+0x12472). Evil Forces never charge, withdraw or retreat. This goes further than the manual, which says some Evil Characters may retreat (finding:ai-evil-units-rarely-retreat).
