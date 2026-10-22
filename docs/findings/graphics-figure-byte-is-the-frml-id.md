---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x037d8
  - disasm:data+0x1de8
  - disasm:data+0x564c
  - resource:BScene.res#FRML 0
  - resource:AAnims.res#FRML 7
  - tool:tools/extract-graphics.ts#decodeFrmlResource
issue: 200
supersedes: graphics-animation-level-figure-sets
---

**A roster entry's figure byte below 20 is the resource id of its FRML figure set, and the sets' pictures agree with the entries that use them: 0 hobbits, 1 elves, 2 men with swords, 3 dwarves, 4 wizards, 5 Gollum, 6 orcs, 7 Ents, 8 Nazgûl and the dead, 9 trolls, 10 wolves, 11 spiders, 12 balrogs, 13 riders, 14 shielded soldiers and 15 spearmen.**
`newFigure` (code+0x037d8) loads the set with a plain resource lookup of type `FRML` and the figure byte as its id, keeping the handle in `frmlHandles` (data+0x564c) at that index. The lookup searches every open resource file, so no table sits between the byte and the set: ids 0 to 6, 8 to 10, 13, 16, 18 and 19 come from BScene.res, and 7, 11, 12, 14 and 15 from AAnims.res. No roster entry uses set 17.

Grouping the roster (data+0x1de8) by its figure byte (byte 20) checks each picture, which was first read by eye, against the names of the entries that use it:

| FRML | Picture                        | Used by                                                                       |
| ---: | ------------------------------ | ----------------------------------------------------------------------------- |
|    0 | a hobbit                       | Frodo, Sam, Merry, Pippin, Bilbo, a hobbit                                    |
|    1 | an elf archer                  | Glorfindel, Legolas, Thranduil, Celeborn, elves                               |
|    2 | a man with a sword             | Aragorn, Boromir, Faramir, Denethor, Rangers, infantry, Southrons             |
|    3 | a dwarf with an axe            | Gimli, Dáin, dwarves                                                          |
|    4 | a wizard with a staff          | Gandalf, Radagast, Saruman, an old man                                        |
|    5 | a small, crouching figure      | Gollum only                                                                   |
|    6 | an orc with a shield           | orcs, hand orcs, Uruk-hai                                                     |
|    7 | an Ent                         | Treebeard, Ents, Huorns                                                       |
|    8 | a hooded figure in a red cloak | the nine Nazgûl, Gothmog, Sauron, a wight, the Dead Men                       |
|    9 | a large troll                  | trolls, half-trolls                                                           |
|   10 | a warg                         | wolves                                                                        |
|   11 | a giant spider                 | Shelob, spiders                                                               |
|   12 | a balrog                       | balrogs                                                                       |
|   13 | a rider on horseback           | Éomer, Théoden, Imrahil and the other captains of horse, cavalry, knights     |
|   14 | a soldier with a shield        | tower guards, infantry, men at arms, Easterlings, Haradrim, Corsairs, bandits |
|   15 | a spearman                     | Dunlendings, Wainriders, Balchoth, Variags                                    |

Sets 16, 18 and 19 are effects started by script events, the fading figure, arrows and a spell (finding:graphics-figure-animation-scripts). Elrond, Círdan, Galadriel and Tom Bombadil have figure bytes 80 to 82, still IMAG pictures (finding:ui-animation-level-figures-walk-off). Set 5, earlier taken for a small orc, belongs to Gollum alone.
