---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e6ca
  - disasm:code+0x069e4
  - disasm:code+0x0e8f0
  - disasm:code+0x08412
  - disasm:code+0x0b73e
  - disasm:code+0x12c8c
  - disasm:code+0x0dbbe
  - disasm:code+0x07422
  - disasm:code+0x131ec
issue: 171
---

**Only three things wake a sleeping entry besides its trigger: the Council of Elrond wakes Gandalf, the Silver Orb wakes the elves of entry 62, and an Encounter that wins the Ring brings the 3rd Nazgûl. Every other write of a moving state sets an awake entry going again.**
These are all the writes of state 1 or 3 to a roster entry in the code:

- An entry's trigger (code+0x0e6ca; finding:ai-trigger-conditions).
- A player's Order, to an awake Force (code+0x069e4).
- A resting entry setting off again once rested (code+0x0e8f0; finding:movement-stamina-and-rest).
- The two parties of a meeting or an announced fight, stopped while it was asked, set moving again when it is answered (code+0x08412 to code+0x085c4).
- The watched Character after a fight on the Animation Level (code+0x0b73e), and the survivors of any fight (code+0x12c8c; finding:combat-losses-taken-when-the-fight-ends).
- The Council of Elrond waking entry 1, Gandalf (code+0x0dbbe; finding:forces-council-forms-the-fellowship-under-gandalf).
- The Silver Orb shown to Thranduil waking and mobilising entry 62 (code+0x07422; finding:mobilisation-token-shown-to-ruler).
- An Encounter that won the Ring bringing entry 81, the 3rd Nazgûl, to the spot with strength 1 (code+0x131ec; finding:objects-ring-taken-by-last-awake-winner).

The search covered immediate writes through a record pointer, writes indexed into the roster's state bytes, and writes to the state byte of a fixed entry.
