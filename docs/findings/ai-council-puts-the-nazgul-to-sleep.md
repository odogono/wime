---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0dbee
issue: 94
---

**The Council of Elrond puts the nine Nazgûl to sleep for good.**
For entries 79 to 87, the Nazgûl Lord and the 2nd to 9th Nazgûl, the state is set to 0, asleep, and the trigger byte to 0 (code+0x0dbee). With no trigger they are never woken again by the trigger test (finding:ai-trigger-conditions). Their strength and health are left alone (finding:forces-nazgul-revival-not-found).
