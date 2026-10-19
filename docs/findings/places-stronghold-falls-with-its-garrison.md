---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:code+0x134cc
  - disasm:code+0x13518
  - disasm:code+0x0296c
  - disasm:code+0x02d36
  - resource:BScene.res#CSTR 50
issue: 45
---

**Each Stronghold stands or falls with one Garrison Unit. When three of the five Garrisons have been destroyed, the game is lost at the end of that fight: "With this battle, Sauron's victory is assured."**
After every fight the code counts how many of these five roster entries have no strength left (code+0x134cc):

| Stronghold         | Entry | Garrison                             |
| ------------------ | ----- | ------------------------------------ |
| Minas Tirith       | 33    | 100 tower guards, following Denethor |
| Lórien             | 61    | 1,000 elves                          |
| Thranduil's Palace | 64    | 500 elves                            |
| Edoras             | 67    | 1,000 light infantry                 |
| the Hornburg       | 68    | 1,000 light infantry                 |

At three or more it calls the losing ending with argument 2 (code+0x13518, code+0x0296c). Argument 1 is the Ring reaching Barad-dûr. Argument 2 shows BScene CSTR 50: "With this battle, Sauron's victory is assured. As his orc hordes spread death and destruction throughout the West, Sauron turns his baleful gaze within his realm. Elusive though he may be, within hours the Ringbearer is caught in the Dark Lord's grasp." (code+0x02d36). The common ending, CSTR 51 and 52, follows and closes "YOU HAVE LOST THE WAR IN MIDDLE EARTH.".

No Place has an owner, and nothing ever writes to the Place table, so Places never change hands. An Evil Force standing in a Stronghold does nothing. Only destroying the Garrison counts, wherever that happens, and a Garrison that marches away leaves its Stronghold standing. Other Units at the same Places, such as Lórien's other elves, don't count. This is how finding:places-three-strongholds-lost-loses works.
