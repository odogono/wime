---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:data+0x4342
  - disasm:code+0x06e60
  - disasm:code+0x0747e
  - disasm:code+0x07492
issue: 102
---

**Bytes 5 to 7 of an object record say what Use does with it, whether it can be used, and whether it is used up: nine objects can be used, and six of them are used up when they work.**
The object record at data+0x4342 (finding:objects-carried-as-a-bitmask) is a name pointer, then four bytes: byte 4 runs from 50 to 65 by object (not traced; probably its picture), byte 5 is its kind of use, byte 6 is set if it is usable (finding:objects-provisions-lists), and byte 7 is set if it is used up. Use switches on byte 5 (code+0x0747e). Kinds 1 to 4 have no case, so nothing happens.

| Object                                             | Kind | Usable | Used up | Use                                                      |
| -------------------------------------------------- | ---- | ------ | ------- | -------------------------------------------------------- |
| the Ring                                           | 1    | yes    | no      | never listed, being bit 0                                |
| a Dwarven Ring                                     | 10   | yes    | yes     | Dáin's Token (finding:mobilisation-token-shown-to-ruler) |
| a Gnarled staff, Mithril mail                      | 4    | no     | no      | none                                                     |
| an Ancient sword, an Elven blade, a Dwarven hammer | 3    | no     | no      | none                                                     |
| a Palantir                                         | 5    | yes    | no      | finding:objects-palantir-vision-or-tip                   |
| an Elven cloak                                     | 2    | no     | no      | none                                                     |
| a blue potion                                      | 6    | yes    | yes     | finding:objects-draughts-heal-and-strengthen             |
| a black flask                                      | 7    | yes    | yes     | finding:objects-draughts-heal-and-strengthen             |
| a glowing vial                                     | 8    | yes    | yes     | finding:objects-draughts-heal-and-strengthen             |
| the Red Arrow                                      | 11   | yes    | yes     | Théoden's Token                                          |
| a coil of rope                                     | 9    | yes    | no      | "There is no need to use the rope here."                 |
| a sceptre                                          | 12   | yes    | no      | Denethor's Token                                         |
| a silver orb                                       | 13   | yes    | yes     | Thranduil's Token                                        |

After the effect, an object marked used up has its bit cleared from the user's objects word (code+0x07492), unless the effect failed: a Token shown to the wrong person is kept. A used-up object is not placed anywhere; it is gone. Kinds 2 to 4 work by being carried: the weapons and armour in a fight (finding:combat-magic-weapons-and-protection) and the cloak in the evasion roll (finding:combat-evasion-chance).
