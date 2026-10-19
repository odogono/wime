---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:data+0x1de8
  - disasm:code+0x0e72c
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**The roster lists the Good Characters, each followed by the Units they lead, then leaderless Good Units, Gollum, the nine Nazgûl, the Evil Units, Sauron and Shelob (entries 1 to 151), and then the advisors, the anonymous Encounter figures, Saruman and the wild creatures (entries 152 to 195).**
Entry 1 is Gandalf and entry 2 is his second form, `GANDALF'`, waiting in Lórien. Entries 3 to 77 are the free peoples: the Fellowship, then the lords of Rohan, Gondor, the Dwarves and the Elves with their Units, then Units with no Character at their head. Entries 78 to 151 are Gollum, the Nazgûl, Saruman's army at Isengard, the Easterlings, Mordor's armies, the Haradrim, the Corsairs, the Orc garrisons, Sauron and Shelob. Entries 152 to 157 are Círdan, Tom Bombadil, Bilbo, Galadriel, Treebeard and Radagast; 158 to 165 are figures such as "a Ranger" and "an old man"; 166 is Saruman; 167 to 195 are Orcs, trolls, a wight, the Dead Men, bandits, Balrogs, wolves and spiders. Only entries 1 to 151 are moved by the main loop (finding:time-clock-advances-after-each-roster-sweep); the rest are met in Encounters (finding:forces-encounter-figures-wait-in-areas).
