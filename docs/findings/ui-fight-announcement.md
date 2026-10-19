---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0f27e
  - disasm:code+0x0f58a
  - disasm:code+0x0f68e
  - disasm:code+0x0f722
  - disasm:code+0x0f7ac
  - disasm:code+0x0f814
  - observed:combat-calembel-ignored
  - observed:combat-east-emnet-ignored
  - observed:combat-faramir-go-there
issue: 45
---

**A fight is announced in a window that names both sides, "<Leader> is attacked by <enemy>.", or "<Place> is being attacked by <enemy>." at a Place that announces attacks, with the buttons "Go there" and "Ignore it".**
A Unit is named with its head count. The Places that announce attacks are those of finding:places-attacks-announced-at-key-places (code+0x0f722). Both Leaders are put in state 2, which the main loop skips, so neither moves again until the fight is over (code+0x0f814). In play the windows read "CALEMBEL is being attacked by 500 orcs.", "EOMER is attacked by 500 orcs." and "FARAMIR is attacked by 444 orcs.".

When the Character being watched on the Animation Level is the one attacked, there are no buttons. A message says who is attacked, and the fight follows there at once (code+0x0f58a).
