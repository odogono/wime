---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:data+0x3b00
  - disasm:data+0x4242
  - tool:tools/extract-starting-state.ts#readStartingState
  - tool:tools/build-geography.ts#traceCrossings
issue: 329
---

**Of the 96 Leaders whose starting destination or Default Orders lead somewhere, the straight way between some pair of stops meets a river tile (rated 20) for 63 of them. Near Rivendell, on the Nazgûl tours and at Osgiliath a Crossing lies within about 70 pixels of the river meeting; elsewhere the nearest is often 200 pixels or more away.**
Each Leader's way was taken as straight lines from its starting position through its destination and the Places of its route row (finding:ai-default-orders-are-place-queues), sampled every 4 pixels against the tile terrain values (finding:movement-rivers-crossed-by-the-straight-step). Each run of river tiles was then measured against the 15 Crossings that `traceCrossings` finds where roads meet rivers (finding:movement-fords-and-bridges-are-crossing-tiles). Greedy steering does not follow the straight line (finding:movement-greedy-tile-steering), so this says which legs have a river to get over, not where a Force meets it. By group:

- **Rivendell.** Frodo's last leg, Bree to Rivendell, crosses the Bruinen one tile north of the Ford of Bruinen, 23 pixels from its Crossing (finding:ai-ring-bearer-crosses-the-bruinen-at-the-nazgul-ford). Glorfindel and Aragorn reach Rivendell from the Ford of Bruinen, a stop already on the Crossing. Gandalf, Elrond and the elven guards step a few pixels into Rivendell over the river beside it, 15 pixels from the bridge there.
- **The Nazgûl.** Their tours stop at Stonebows Bridge, the Last Bridge and the Ford of Bruinen, so they reach those rivers on Crossings. Only the 2nd Nazgûl's leg from Woodhall to Deadman's Dike crosses the Brandywine away from a stop, 16 and 21 pixels from two bridges.
- **Saruman and Rohan.** The hand orcs of entry 89 (Isengard to East Emnet) and the Rangers of entry 57 (Isen Ford to Minas Tirith) cross the Entwash, where the nearest Crossing is the Isen Ford, 206 and 227 pixels back (finding:mobilisation-isen-ford-tripwire-sits-on-a-crossing). The other Saruman entries' routes do not meet a river.
- **Gondor.** Imrahil, Dervorin, Duinhir, Golasgil, Hirluin and the infantry of entries 72, 73 and 75 cross the rivers of Lebennin and Lamedon 230 to 320 pixels from any Crossing. Their legs from Pelargir to Minas Tirith cross rivers 24 to 38 pixels from the bridges near Pelargir and Lossarnach.
- **The Elves and Gollum.** Celeborn's legs to Dol Guldur and back, Gollum's from Dimrill Dale to Dol Guldur and the Rammas Forts, cross the Anduin and its tributaries 290 to 420 pixels from any Crossing.
- **The armies of event 7.** Every leg through Osgiliath, Cair Andros and the Rammas Forts crosses the Anduin 13 to 72 pixels from the Osgiliath bridge. Legs into Wilderland, Lórien and Dimrill Dale cross rivers 200 to 640 pixels from any Crossing. The routes that return west cross the Brandywine at Sarn Ford or Stonebows Bridge, within 13 pixels, and the Bruinen near Rivendell within 16.
