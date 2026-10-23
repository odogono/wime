---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x130a0
  - disasm:code+0x13114
  - disasm:code+0x131d8
  - disasm:code+0x1326e
  - disasm:code+0x1327a
  - disasm:code+0x13304
  - disasm:code+0x133bc
  - disasm:code+0x1342c
issue: 250
supersedes: objects-ring-taken-by-last-awake-winner
---

**When an Encounter wins a fight with the Ring lying at the fight's place, the 3rd Nazgûl is revived, moved there and always takes the Ring.**
The end of a fight searches the placement slots for object 0, the Ring,
and checks both coordinates against the fight's place before choosing a
bearer (code+0x130a0). A slot with another object or either coordinate
different skips the entire handoff, including the revival. No Ring at
the fight means no Nazgûl is sent.

When Evil wins and its entry is above 151, the Encounter branch at
code+0x131d8 writes directly into roster entry 81, the 3rd Nazgûl.
His record starts at data+0x29ee, which is data+0x1de8 + 81 × 38
(finding:data-formats-roster-record-layout):

| Address                  | Record offset | Write                                                      |
| ------------------------ | ------------- | ---------------------------------------------------------- |
| data+0x29f6, data+0x29f8 | 8, 10         | Campaign Level position from the Ring's placement slot     |
| data+0x2a04              | 22            | state 1, moving and awake                                  |
| data+0x29f4              | 6             | strength 1                                                 |
| data+0x2a08              | 26            | current health from maximum health, byte 25 at data+0x2a07 |

These writes are unconditional within the Encounter branch: sleeping,
dead and wounded Nazgûl are all restored. Entry 81 is added as the Evil
row, and "The 3rd NAZGUL is sent to the site." is shown (code+0x1322c).
The subsequent bearer search requires a nonzero state (code+0x132b8),
which the revival guarantees. This corrects the superseded Finding's
claims that he takes the Ring only if awake and stays where he stands
on the Campaign Level; these are roster writes, not merely placement
of an Animation Level figure.

The other winner-selection rules are unchanged. Each row is read
through its first roster entry:

- **Good wins:** the first Good row with starting strength 1, strength
  remaining, Animation Level figure 0 (a Hobbit), and an index other
  than Gollum's 78 takes the Ring (code+0x13114). Otherwise the last-listed
  awake Good row takes it, Character or Unit alike (code+0x1327a).
  Gollum is skipped unless Good's total strength is 1.
- **Evil wins as a Force:** with an Evil entry of 151 or below, the
  last-listed awake Evil row takes it (code+0x131a8).

The Ring's placement slot is freed before the bearer search, so with
nobody eligible to take it the Ring is lost (code+0x1326e). The bearer
gets bit 0 of its objects word and becomes the Ring-bearer, with
"<name> now has the RING.", or "have" for a Unit (code+0x13304).
An Evil bearer, including the revived 3rd Nazgûl, leaves its Leader,
loses its Default Orders and sets off for Barad-dûr, (1856, 1120)
(code+0x133bc). Every other awake Nazgûl, entries 79 to 87, not carrying
the Ring loses its Default Orders and is sent by a roll of 4 to Dol
Guldur (1456, 672), the Morannon (1744, 1008), or Minas Morgul
(1664, 1168), the last twice as likely (code+0x1342c).
