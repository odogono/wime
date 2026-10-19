---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x11046
  - disasm:code+0x1108a
  - disasm:code+0x110b6
  - disasm:code+0x111d6
  - disasm:code+0x1130e
issue: 45
---

**Byte 24 of a roster entry is two flags: bit 0 gives a magic weapon and bit 1 magic protection. An Ancient sword, Elven blade or Dwarven hammer also counts as a magic weapon, and a Gnarled staff, Mithril mail or the Ring, while worn, as protection.**
A row's blow goes into its side's magic blows if it has a magic weapon, otherwise into its ordinary blows (code+0x11046). A protected row takes the enemy's magic blows at full strength and ordinary blows at a quarter (code+0x1130e). Magic blows beyond the total toughness of the enemy's protected rows are added to the ordinary blows (code+0x111d6). So magic only matters against protected enemies.

Byte 24 is 3, both flags, for Gandalf, Elrond, Glorfindel, the Nazgûl, Sauron and the Balrogs; 2 for trolls and Shelob; and 1 for Aragorn. The objects are bits 3 to 5 and 2 and 6 of the objects word (finding:objects-carried-as-a-bitmask).
