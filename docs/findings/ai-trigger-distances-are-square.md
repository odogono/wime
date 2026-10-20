---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e50c
  - disasm:code+0x0e566
  - disasm:code+0x0e59e
  - disasm:code+0x0e5f8
  - observed:war-events-ring-bearer-near
  - observed:war-events-gandalf-near
issue: 57
---

**The proximity triggers compare each axis separately, inclusively: bit 0 fires when the Ring-bearer's Force is no more than 9 pixels away in x and in y, and bit 2 when an awake Gandalf is no more than 4 pixels away in x and in y.**
For bit 0 the game follows the Ring-bearer's chain of Leaders to its end and takes that Leader's position (code+0x0e50c), since a follower's own position is not kept up to date. It then tests `|dx| <= 9` and `|dy| <= 9` (code+0x0e566). The Ring-bearer's state is not checked.

For bit 2 it tests the first Gandalf, entry 1, then the second, entry 2 (code+0x0e59e, code+0x0e5f8). Either counts if its state is not 0 and `|dx| <= 4` and `|dy| <= 4`. It uses that entry's own position, without following any chain of Leaders, so a Gandalf travelling as a follower is tested where he last stood as a Leader. A resting or skipped Gandalf counts. A dead one does not, since death sets the state to 0 (finding:ai-trigger-what-waking-changes).

In play, with Aragorn asleep at (784, 380) and Frodo halted at (793, 389), Aragorn woke in the next sweep. At (794, 380) or (784, 390) he did not. Frodo following Sam at (775, 371), with Frodo's own position far away, woke him too. Théoden at (1248, 992) was mobilised by the first Gandalf at (1252, 996) and by a resting second Gandalf at (1244, 988), but not by the first Gandalf at (1253, 992).
