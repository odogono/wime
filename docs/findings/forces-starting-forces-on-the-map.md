---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:data+0x1de8
  - disasm:code+0x0d26c
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Only 42 Forces are awake and drawn at the start; the other 81 Forces among entries 1 to 151 are asleep at their starting positions until something wakes them.**
The Campaign Level draws a Force only if its leader's state byte is not 0 (code+0x0d26c). The awake Forces are Frodo, Sam and Pippin at Hobbiton; the nine Nazgûl, four in the Shire and five around Sarn Ford; Éomer at East Emnet; Faramir in North Ithilien; Dáin at Erebor; Brand at Dale; Thranduil at his palace; Théoden at Edoras; Théodred at the Isen Ford; Erkenbrand at the Hornburg; Denethor at Minas Tirith; Imrahil at Dol Amroth; the Iron Hills Dwarves; Units of Rohan at Edoras and the Hornburg; Units of Gondor at the Rammas, Osgiliath, Cair Andros, Linhir and Pelargir; three of Saruman's armies at Isengard; an Orc army at Mount Doom; and the Orc and troll garrisons of Gundabad, Goblin Town, Dimrill Dale, Dol Guldur and Mordor. Asleep are, among others, Gandalf with Boromir, Legolas and Gimli at Rivendell, Elrond, Glorfindel, Aragorn near Bree, Merry at Buckland, Celeborn and the Elves of Lórien, the Ents, Gollum, the rest of Saruman's army, and the armies of Mordor, Rhûn and Harad. The sleepers wake by the rules in finding:ai-wake-conditions.
