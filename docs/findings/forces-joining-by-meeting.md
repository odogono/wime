---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0fc18
  - disasm:code+0x0843e
  - disasm:code+0x0fd5c
issue: 81
---

**Recruiting a Leader is the follow choice of a meeting: "ARAGORN welcomes FRODO to join." with "Follow ARAGORN" or "Continue on", and following changes only the follower's Leader byte.**
The window for a meeting with a mobilised Leader (finding:forces-meeting-of-non-evil-leaders) reads "<A> meet(s) <B>." and "<B> welcome(s) <the> <A> to join.", with "Follow <B>" and the default "Continue on" (code+0x0fc18). Accepting (code+0x0843e) sets A's Leader byte to B, lets both move again, and if A was watched, watches B instead; allegiance and destination are untouched. Declining only lets both move on. Leaders not yet mobilised (allegiance 1 or 2) can never be recruited this way: they only offer "Go there". The choice also changes the music to B's theme (code+0x0fd5c).
