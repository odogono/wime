---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x0dd88
  - disasm:code+0x0ddc4
  - disasm:code+0x0dddc
  - disasm:code+0x02e64
  - observed:ending-ring-at-mount-doom
  - observed:ending-evil-bearer-at-mount-doom
issue: 103
---

**The game is won when the Leader of the Ring-bearer's Force stands exactly on Mount Doom, (1808, 1120), at a whole hour on the Campaign Level. Nothing tests the Leader's allegiance.**
The test follows the hourly Council of Elrond test in the same routine (finding:ai-council-of-elrond-trigger), and runs every hour whether or not the Council is still to come or the pointer is shown. It reads the Ring-bearer byte (data+0x3e6a), follows the leader byte up the chain to the top Leader (code+0x0dd88), and compares that Leader's position with (1808, 1120) exactly (code+0x0ddc4). On a match it calls the winning ending (code+0x0dddc), the same one destroying the Garrison of Barad-dûr calls (finding:places-destroying-barad-dur-garrison-wins).

So any Force carrying the Ring wins on reaching Mount Doom, as the manual says (finding:objects-ring-to-mount-doom-wins), but the test does not check that the Force is Good: an Evil Ring-bearer's Leader standing on Mount Doom at the hour would win the game for the player too. A Force passing over Mount Doom between hour marks does not win. The test reads the Ring-bearer byte, not the objects words, so a Ring lying on the ground still counts through its last bearer.
