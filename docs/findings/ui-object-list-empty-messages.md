---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0876c
  - disasm:code+0x0899e
  - disasm:code+0x08b52
issue: 105
---

**When a list would be empty, a one-line box without buttons opens at (10, 5) instead: 176 wide for "<name> is unwilling to part with anything." and "<name> has nothing which is 'usable'.", 160 wide for "There are no objects here.", all 24 deep, with the text at (10, 8) in colour 5.**
Put Down (code+0x0876c) and Use (code+0x08b52) draw the Character's name and the rest of the line into the box; Take (code+0x0899e) passes its text to the box routine with colour 5 (finding:ui-message-box-text-colour). Each box closes by itself after 200 frames, or 60 when the clock limit data+0x08c2 is 0 (finding:ui-war-event-messages), and the Force's figures walk on at once (code+0x0aa06).
