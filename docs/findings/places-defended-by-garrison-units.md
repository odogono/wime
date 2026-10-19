---
kind: fact
topic: places
confidence: provisional
sources:
  - disasm:code+0x0e892
  - disasm:data+0x1de8
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 45
---

**A defended Place is probably defended only by its Garrison: Units that stand on the Place with no destination, many of them with a higher fighting strength than the same troops in the field.**
The Evil citadels each start with an awake Garrison: Dol Guldur has 1,000 orcs, the Morannon 10,000, Carach Angren 3,400, Minas Morgul 10,000 and Cirith Ungol 2,500. Barad-dûr has 9,500 orcs and 500 trolls. Their fighting strength is 3 or 4 (7 for the trolls), against 2 for orcs in the field (5 for trolls). Minas Tirith's tower guards have 4 against 2 for Gondor's infantry. The light infantry of Edoras and the Hornburg have 2 against 1 for other light infantry.

A Leader with no destination is never moved (code+0x0e892), so a Garrison never starts a fight. It fights only when an enemy comes within reach. Since the combat code has no bonus for the Place (finding:combat-no-place-or-terrain-modifier), these stronger Garrisons are the most likely reading of the manual's costlier assaults on fortresses, citadels and walled cities (finding:combat-defences). This is an inference from the starting data; the manual's order of strength has not been found in the code.
