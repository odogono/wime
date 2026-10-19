---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x10e92
  - disasm:code+0x10fe6
  - disasm:code+0x112b8
  - disasm:code+0x11d70
  - disasm:code+0x12486
  - disasm:code+0x12672
issue: 45
---

**A Charge adds the row's head count × fighting strength to its blow for one round. The next round the charger is easier to hit, and then it is back on Engage.**
The extra blow is added at code+0x10fe6. After the round the row's option becomes "charged" (code+0x12672), and after the next it becomes Engage (code+0x12486). In the charged round the row strikes normally. Its toughness against its share of the enemy's blows drops to two-thirds (code+0x112b8), but against the blows left over it counts its fighting strength a third higher (code+0x11d70). The player can choose Charge again in a later round.

There is no first strike. Both sides' blows for the round are worked out before any losses (code+0x10e92), so a charger takes that round's losses even if its Charge destroys the enemy. The manual's "no losses if the Charge destroys the opponent" (finding:combat-option-charge) is not what the code does.
