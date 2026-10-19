---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:data+0x3db0
  - disasm:code+0x06bb4
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Objects lying on the map are a 30-slot table at data+0x3db0. Each slot holds an object number and a position, and 25 slots are filled at the start.**
Each slot is 6 bytes: the object's bit number (finding:objects-carried-as-a-bitmask), a zero byte, then x and y in Campaign Level pixels. An empty slot has object 99. A Character standing on a slot's exact position can pick the object up, which zeroes the slot's x (code+0x06bb4). At the start the Dwarven Ring lies just north of Dol Guldur and the Gnarled staff in the Old Forest, between Buckland and Bombadil's House. The Ancient sword lies near Ost-in-Edhil, and three Elven blades lie at Bombadil's House and the Barrow Downs. The Dwarven hammer is near Erebor and the Palantir near Forlond. Lórien holds the Elven cloak, a glowing vial and the coil of rope. The sceptre is near Annúminas, and the silver orb near Mount Gundabad. The Red Arrow lies on the same tile as Mithril mail and a black flask, just south of Mount Gram. There is Mithril mail at Rivendell and Belegost too, and a second glowing vial south-west of Isengard. Blue potions lie near the White Towers, the Grey Havens, Michel Delving and south-west of Isengard, and black flasks near Forlond and Tuckborough.
