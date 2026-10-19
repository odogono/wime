---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0eee6
  - disasm:code+0x0e4e4
  - disasm:code+0x0d4c2
  - disasm:code+0x0d26c
  - manual:pdf-p9
issue: 28
---

**A Nazgûl that ends its journey at the Ford of Bruinen goes to sleep until the Ring-bearer comes within 9 pixels, and while asleep it has no dot on the Full Map Level and no icon on the Campaign Level. This is the only way the code hides a living Force.**
When a Force finishes its orders (code+0x0eee6), an entry from 79 to 87, the nine Nazgûl, standing on Place 22, the Ford of Bruinen, has its state set to 0 (asleep) and its trigger to 1, the Ring-bearer test (finding:ai-trigger-conditions); any other entry rests (state 3). The Nazgûl Lord's Default Orders end at Place 22. Both the Full Map dots and the Campaign Level icons skip sleeping entries, so the Nazgûl vanish from both maps and wake, set going on their Default Orders again, when the Ring-bearer's Force comes close. This fits the manual's warning that the Nazgûl can hide and their symbol disappears (finding:forces-nazgul-can-hide). No other code puts a living entry to sleep: the only other place that clears the state is death (code+0x129dc).
