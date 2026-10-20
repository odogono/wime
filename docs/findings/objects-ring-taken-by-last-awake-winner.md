---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x130a0
  - disasm:code+0x13114
  - disasm:code+0x1326e
  - disasm:code+0x1327a
  - disasm:code+0x131d8
  - disasm:code+0x13304
  - disasm:code+0x133bc
  - disasm:code+0x1342c
issue: 107
supersedes: objects-ring-passes-after-a-fight
---

**After a fight the Ring lying at the fight's place goes to the first living Hobbit among Good winners, or else to the last-listed awake row of the winning side, Character or Unit alike. With an Encounter for the winner, the 3rd Nazgûl takes it where he stands.**
The end of a fight looks through the placement slots for the Ring lying exactly at the place of the fight (code+0x130a0), and frees that slot before choosing a bearer, so a Ring with nobody left to take it is lost (code+0x1326e). Each row is read through its first roster entry.

- **Good wins** (Good's strength total above 0): the first Good row whose entry has a starting strength of 1, strength left, Animation Level figure 0 (the Hobbits) and is not Gollum, entry 78, takes it (code+0x13114). With no such Hobbit, the rows are searched from the last Good row back, and the first whose entry is awake takes it, whether a Character or a Unit (code+0x1327a). Gollum is passed over unless Good's strength total is 1, that is, unless he is all that is left.
- **Evil wins, as a Force** (the Evil party's entry is 151 or below): the same backward search over the Evil rows.
- **Evil wins, as an Encounter**: "The 3rd NAZGUL is sent to the site." is shown, and the 3rd Nazgûl, entry 81, is added as a row and takes the Ring if awake (code+0x131d8). Only the Animation Level's figure is placed at the fight; his position on the Campaign Level is not changed.

The bearer gets bit 0 of its objects word and becomes the Ring-bearer, with "<name> now has the RING.", or "have" for a Unit (code+0x13304). An Evil bearer is given Barad-dûr, (1856, 1120), as its destination, leaves its Leader and loses its Default Orders (code+0x133bc). Then every awake Nazgûl, entries 79 to 87, not carrying the Ring, has its Default Orders cleared and is sent by a roll of 4 to Dol Guldur (1456, 672), the Morannon (1744, 1008), or Minas Morgul (1664, 1168) on 2 and 3 (code+0x1342c). This corrects the earlier reading that a Unit takes the Ring only when no Character is left, and that the 3rd Nazgûl is moved to the place.
