---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0fb2c
  - disasm:code+0x0dcfe
issue: 81
---

**Each advisor is met only once, except Radagast, who comes back every 10 to 15 days, and Bilbo, who can be met only after the Council of Elrond.**
As soon as an advisor (allegiance 3) is met, before any window opens, the code changes its chance byte (code+0x0fb2c). A chance of 100 drops to 0, so the advisor is in effect met once, whether or not the player goes to talk; the one-in-a-hundred chance of 0 (finding:forces-encounters-by-allegiance) can bring it back rarely. Radagast, with a chance of 1, instead has his first day set to today plus 10 plus random(6). Bilbo starts with a chance of 0, and the Council of Elrond sets it to 100 (code+0x0dcfe).
