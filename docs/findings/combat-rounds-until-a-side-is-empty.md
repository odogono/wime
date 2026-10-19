---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10e5a
  - disasm:code+0x10e9e
  - disasm:code+0x1268e
  - disasm:code+0x1272e
  - disasm:code+0x127c2
  - observed:combat-faramir-go-there
issue: 45
---

**A fight is fought in rounds, and the rounds go on until one side has no strength left in its rows that have not retreated. The other side wins.**
At the start of each round the code adds up the strength of each side's rows that are not retreating or gone (code+0x10e5a). Withdrawn rows count, so a side doesn't lose while it still has a Withdrawn row. After the round, if either total is 0 the fight is over and the side with strength left has won (code+0x1268e). The combat window then says "The good forces are victorious!" or, in red, "The forces of EVIL have won." (code+0x1272e, code+0x127c2). There is no limit on the number of rounds. This is how finding:combat-ends-when-one-side-is-gone works.
