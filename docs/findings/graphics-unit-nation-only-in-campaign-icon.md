---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x0d2e0
  - disasm:data+0x1de8
  - resource:AMaps.res#IMAG 100
  - manual:pdf-p9
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 301
---

**The original keeps no Nation field: a Unit's Nation exists only as the shield picture its Campaign Level icon byte picks, and only the icon drawing reads that byte.**
Byte 18 of the roster record (finding:data-formats-roster-record-layout) is read once in the whole program, by `drawCampaignForces` at code+0x0d2e0, to choose a cell of the icon sheet (finding:graphics-campaign-icon-sheet-is-imag-100). Nothing in the fight, mobilisation or AI code reads it, and no other byte names a people. So the Nation is whatever shield the icon shows; the name ("infantry", "orcs") gives only the troop type, and neither the leader nor the starting Place is consulted.

The icons the starting Units use, with the Nation their shield shows (manual p. 9, finding:graphics-unit-badge-nation-shields) and the weapon on it (finding:graphics-unit-badge-weapons):

| Icon | Shield                          | Weapon     | Units (roster index)                                             |
| ---- | ------------------------------- | ---------- | ---------------------------------------------------------------- |
| 0x05 | Gondor (Minas Tirith), heraldic | sword      | Faramir's Rangers 16, tower guards 33                            |
| 0x10 | Gondor (Minas Tirith), round    | spear      | 34, 69, 70, 71                                                   |
| 0x11 | Gondor (Dol Amroth), heraldic   | horse head | Imrahil's knights 43                                             |
| 0x12 | Gondor (Dol Amroth), heraldic   | spear      | Imrahil's men at arms 44                                         |
| 0x13 | Gondor (elsewhere), heraldic    | spear      | Forlong's men at arms 46                                         |
| 0x14 | Gondor (elsewhere), round       | sword      | 48, 52, 72, 73, 74, 76                                           |
| 0x15 | Gondor (elsewhere), round       | spear      | 50, 53, 55, 75, 77                                               |
| 0x20 | Rohan                           | horse head | every Rohan cavalry, Rohirrim scouts 159                         |
| 0x21 | Rohan                           | spear      | 67, 68                                                           |
| 0x22 | aquamarine, dithered (Dale's)   | sword      | Rangers 57                                                       |
| 0x23 | aquamarine, dithered (Dale)     | spear      | Brand's 20, 21                                                   |
| 0x24 | aquamarine, plain (Erebor)      | axe        | Dain's dwarves 18                                                |
| 0x25 | dark green (Iron Hills)         | axe        | dwarves 58                                                       |
| 0x30 | green (Elves or Ents)           | bow        | every elf Unit, ents 65, huorns 66                               |
| 0x32 | a Nazgûl figure, not a shield   | none       | Dead Men 178                                                     |
| 0x33 | Saruman, White Hand             | sword      | hand orcs and uruk-hai 88 to 96                                  |
| 0x34 | Dunlendings, wooden             | spear      | 92, 95, 179, and the Encounter "Southrons" 180                   |
| 0x35 | lidless eye, dark (Easterlings) | spear      | Balchoth 97, 99, Easterlings 100                                 |
| 0x40 | lidless eye, dark (Easterlings) | spear      | Wainriders 98, 101, 102                                          |
| 0x41 | lidless eye, red (Harad)        | spear      | Haradrim 131, Variags 133                                        |
| 0x42 | lidless eye, red (Harad)        | spear      | Southrons, Haradrim 134, Variags 137, Encounter bandits 181      |
| 0x43 | lidless eye (Mordor)            | club       | every troll, halftrolls 135, wolves 188 to 191, spiders 192, 194 |
| 0x44 | lidless eye (Mordor)            | scimitar   | every orc Unit, Misty Mountains and Dol Guldur included          |
| 0x45 | Umbar, ship's sail              | scimitar   | Corsairs 139                                                     |

The pictures differ from the manual's list in places. Dale's shield is drawn as a dither of green and cyan, so it is told apart from Erebor's plain aquamarine after all, and the Rangers carry the same shield. The orcs of the Misty Mountains and Dol Guldur carry Mordor's shield, and the wolves and spiders the trolls'. Two icons for the same people (0x14 and 0x15, 0x41 and 0x42) differ only in the weapon, and the weapon does not always follow the Unit's name: Duinhir's and Hirluin's "infantry" carry the spear of light infantry. The colours named here are those of the exported sheet, whose palette for column 4 has not been checked against the Campaign Level's.
