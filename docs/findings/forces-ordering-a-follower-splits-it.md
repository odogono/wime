---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x06966
  - disasm:code+0x069e4
  - disasm:code+0x069f6
  - disasm:code+0x06a24
  - disasm:code+0x06a82
issue: 68
supersedes: movement-ordering-part-of-a-force
---

**Giving an Order to a member of a Force splits it off with its own followers. It takes its top Leader's position and facing, stops following, loses its Default Orders and sets off for the Order's destination. A Unit that follows someone cannot be ordered on its own.**
The Order code (code+0x06966) first refuses a selected member that has a Leader and whose starting strength is not 1, a Unit. Otherwise it:

1. sets the member's destination to the clicked spot, rounded down to a tile origin;
2. sets its state to 1, moving (code+0x069e4);
3. empties its route row, so its Default Orders are gone (code+0x069f6);
4. walks up its chain of Leaders and copies the top Leader's position and facing to it (code+0x06a24);
5. clears its Leader byte (code+0x06a82).

The member's own followers still name it as their Leader, so they go with it. Ordering a Leader does the same, except that it has no chain to walk. There is no other way to leave a Force, apart from a Leader's death (finding:forces-followers-of-a-dead-leader) and Gollum's escape (finding:forces-gollum-sneaks-away-from-a-wizard). A follower's own position is not kept while it follows (finding:movement-mixed-force-at-leader-pace), which is why the split copies the top Leader's.
