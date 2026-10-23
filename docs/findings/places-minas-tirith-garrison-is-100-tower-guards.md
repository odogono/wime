---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:data+0x1de8
  - disasm:code+0x1286e
  - tool:tools/extract-starting-state.ts#readStartingState
---

**Minas Tirith's Garrison starts as only 100 tower guards, and nothing in the original ever adds to it: Units lose strength in combat but never gain any.**
The Garrison is roster entry 33 (finding:places-stronghold-falls-with-its-garrison). Its record in the starting roster (data+0x1de8, 38 bytes each) holds a starting strength and strength of 100, fighting strength 4, and Leader byte 32, so it follows Denethor. It is awake but not yet mobilised, like Denethor. The rest of the city's defence is in other entries. Entry 34, 1,500 infantry at fighting strength 2, also follows Denethor. Entry 69, 100 infantry at the Rammas Forts, stands within reach of a fight at the city; entry 70, 400 infantry at Osgiliath, is 16 pixels away and outside it (finding:combat-place-defended-by-the-forces-near-the-fight). Only entry 33 counts towards losing the Stronghold.

Nothing reinforces the Garrison. In the game logic, the only code that writes a roster entry's strength word is the routine that takes combat losses (code+0x1286e), which subtracts losses or clears the word to 0. No code adds to it, so there is no mobilisation bonus, recruitment or regrowth. Mobilisation does bring more troops to the city: on war event 3, once Denethor is mobilised or event 7 is set, Forlong (200 men at arms), Dervorin (300 infantry), Duinhir (500 infantry), Golasgil (100 infantry, 400 light infantry), Hirluin (300 infantry) and Imrahil (500 knights, 700 men at arms) wake or mobilise with routes that lead to Minas Tirith. They are separate Forces that help in fights near the city. They never join entry 33's strength.

The port loads the same records from the Reference Build (`web/public/assets/starting-state.json`), so its Garrison matches the original's.
