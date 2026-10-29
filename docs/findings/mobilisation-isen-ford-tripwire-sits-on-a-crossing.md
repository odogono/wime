---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0ef60
  - disasm:data+0x3b00
  - tool:tools/extract-starting-state.ts#readStartingState
  - tool:tools/build-geography.ts#traceCrossings
issue: 329
---

**The Isen Ford tripwire's tile origin, (1104, 928), is the tile of the Fords of Isen's Crossing, so any Evil Leader routed over that Crossing sets War Events 3 and 5. Saruman's first wave reaches it by its Default Orders anyway.**
The ford Crossing traced from the roads lies at (1107, 935), on the tile whose origin the tripwire tests (finding:mobilisation-evil-at-the-fords-of-isen). Saruman's hand orcs of entries 88 and 89 both wait for event 4 with no delay and start at Isengard, (1088, 896). Entry 88's only stop is the Isen Ford, two tiles away, so it sets events 3 and 5 within hours of event 4, whatever entry 89 does. Entry 89 heads for East Emnet, and its way meets the Entwash, where the nearest Crossing is the Isen Ford, 206 pixels back (finding:ai-default-orders-that-cross-rivers). Entries 90 to 96 follow 7 to 10 days later with the Isen Ford as their first stop.

After event 7 the routes of entries 109, 111 and 116 to 118 also stop at the Isen Ford. Event 7 brings events 3, 4 and 6 but not 5 (finding:ai-war-events), so those armies, or any Evil Force passed over this Crossing, can still set event 5 and raise the Rohan musters.
