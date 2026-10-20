---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x08eea
  - disasm:code+0x0843e
  - disasm:code+0x08596
  - disasm:code+0x05b54
  - observed:forces-meet-mobilised-characters
issue: 68
supersedes: forces-characters-join-by-following
---

**Answering "Follow <B>" makes A follow B: A's Leader byte becomes B, and both Leaders set off again (state 1). Nothing else changes. "Continue on", or no answer, only sets them off again.**
The answers are button 0xbd and 0xbe in the main loop's dispatch (code+0x08eea). Follow (code+0x0843e) sets both parties' state to 1 and A's byte 35 to B. A keeps its own position, destination and route. Since only Leaders move (finding:forces-leader-byte-forms-forces), A then travels as part of B's Force, and A's own followers come along through the chain. If the Character being watched was A, the watch moves to B. Continue on (code+0x08596) only sets both states to 1. When the window times out, its default, Continue on, is dispatched the same way (code+0x05b54).

The manual's "the two figures are replaced by the Leader's figure" is this. A's icon is no longer drawn because A now has a Leader.

In play, Faramir (15), with his Rangers (16) following him, answered "Follow EOMER". Faramir's Leader byte became 13, Faramir and Éomer went from state 2 to 1, Faramir stayed at (1360, 960), and the Rangers still followed Faramir. Left unanswered, the same meeting closed after about 14 seconds with both back in state 1 and no Leader changed.
