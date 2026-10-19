---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:data+0x4342
  - disasm:code+0x06cda
  - disasm:code+0x06e26
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**The objects a Character carries are bits of a 16-bit word (bytes 16 and 17 of the roster record), one bit per entry of a 16-object table; Frodo starts with the Ring and an Elven blade, and Aragorn with an Ancient sword.**
The object table at data+0x4342 has 8-byte records: a pointer to the name and four bytes not yet decoded. The objects are, by bit: the Ring, a Dwarven Ring, a Gnarled staff, an Ancient sword, an Elven blade, a Dwarven hammer, Mithril mail, a Palantir, an Elven cloak, a blue potion, a black flask, a glowing vial, the Red Arrow, a coil of rope, a sceptre and a silver orb. A 17th record, "other useful objects", has no bit. Picking an object up sets its bit (code+0x06cda) and giving it away clears it (code+0x06e26). No other entry carries anything at the start. This confirms finding:objects-ring-starts-with-frodo.
