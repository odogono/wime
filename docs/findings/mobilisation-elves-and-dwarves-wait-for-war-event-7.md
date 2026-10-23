---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0e148
  - disasm:code+0x0e170
  - disasm:code+0x0e184
  - disasm:code+0x0efec
  - disasm:code+0x07136
issue: 243
---

**The Elves' and Dwarves' hosts wake only after War Event 7, the event that also sends Mordor's hosts out. So before day 169, short of the Mordor tripwire or the Palantír, a player can raise only Rohan, Gondor and the four rulers with their followers.**
The daily check sets event 6 only when event 7 is already set (code+0x0e170). Only one instruction in the game sets bit 6 (code+0x0e184). Event 3, Gondor, follows either event 7 or Denethor's allegiance rising above 1 (code+0x0e148). Event 7 comes from day 169, a non-Evil Leader on the Mordor tripwire (code+0x0efec, finding:ai-good-force-near-mordor-starts-the-war) or the Palantír (code+0x07136) (finding:ai-war-events-set-once).

The trigger bytes in the starting roster show who waits for which event (finding:ai-trigger-conditions):

- 0x40 to 0x4a: Dáin's dwarves (58), the elven guards (56) and the elves of entries 59 to 64, with Lórien's and Thranduil's Garrisons (61, 64). They wait for event 6, so for event 7.
- 0x80 to 0x8d: every host of Mordor and its allies, from Sauron to the Corsairs. They also wait for event 7, then 0 to 13 days.
- 0x08: Gondor's lords and infantry. They wait for event 3.
- 0x20 to 0x24: the Rohan musters. They wait for event 5, Théoden's allegiance.

Dáin, Thranduil, Théoden and Denethor stand awake at allegiance 1, so a Token can mobilise each of them before the war (finding:mobilisation-token-shown-to-ruler), and Gandalf rouses Théoden by coming near him. The sceptre on Denethor sets event 3 and so wakes Gondor. The orb also wakes the 1,000 elves of entry 62. But no Token sets event 6, so the rest of the Elves and Dwarves stay asleep until event 7, and event 7 also wakes Mordor. Any plan that needs them has to start the war first.
