---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ea64
  - disasm:code+0x0eab2
  - disasm:data+0x4242
  - observed:east-emnet-to-edoras
issue: 295
---

**A river slows a Force and turns it aside but does not stop it: one time in ten at each tile origin a Force steps straight toward its destination onto any tile rated 10 or more, which takes in rivers (20) and mountains (10) but never sea, lake or coast (5).**
At a tile origin moveEntry rolls random(100) (code+0x0ea64). On 90 or more it reads the terrain value of the next tile in the desired facing and, if it is at least 10 (code+0x0eab2), takes that facing without scoring the neighbours (finding:movement-greedy-tile-steering). Otherwise the scoring rarely picks a river tile, since 20 times any weight loses to a bank tile rated 60 off to the side. Once in the river the Force moves at a fifth of its pace (finding:movement-terrain-percent-scales-pace), and at the next tile origin the far bank, straight ahead at 100 × 60, wins the scoring, so it climbs out on the other side.

This explains Éomer at the Entwash (finding:movement-rivers-block-route-finding). The river there is column 82, tiles 23 and 25, rated 20; the tiles 228, 244 and 247 he was seen not to cross are bank tiles in column 83. At (1328, 960) the river ahead scores 2,000 and tile 244 to the north, rated 80, scores 39 × 80 = 3,120, so he turns north. At (1328, 944) the desired facing is south-west, and tile 244 to the south-east scores 3,120 against the river's 2,000, so he turns back to (1344, 960), where the plain to the west scores 6,000 and brings him back to the bank. That is the observed loop. Each pass gives two one-in-ten chances to step into the river, about one pass a day on 40 stamina, so four days without crossing has odds of about 0.9⁸ ≈ 0.43. Sea, lake and coast tiles fall under 10 and are never taken straight on; the scoring picks one only when nothing round the Force rates better, so in practice no Force walks into the sea. No tile is rated 0, and nothing else in movement makes ground impassable.
