---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ebf8
  - disasm:code+0x0e3f4
  - disasm:data+0x4242
issue: 10
supersedes: movement-terrain-limits-pace
---

**Every map tile has a terrain value from 5 to 100 (data+0x4242, one byte per tile number), and a movement step's speed-table pace is scaled by that value as a percentage.**
The step at code+0x0ebb6 reads the terrain value of the tile under the entry's centre (position + 8, code+0x0e3f4), multiplies the speed-class pace from finding:movement-speed-classes by it and divides by 100, then adds the result to the pixel-fraction byte. So the full class pace applies only on the 44 tiles rated 100, which include the road and track tiles 104 and 105; Frodo's class-1 road pace of 336/256 ≈ 1.31 px/tick and Faramir's class-3 track pace of 414/256 ≈ 1.62 px/tick are the 100% cases. Open-plain tile 33 and the Ithilien wood tiles 229 and 247 are rated 60, so Éomer's class-4 cavalry manages 460 × 60/100 / 256 ≈ 1.08 px/tick there, matching the observed "about 1 px/tick off road". The other ratings in use are 5, 10, 15, 20, 30, 40, 45, 50, 70, 75, 80 and 90; the lowest, 5, covers tiles 0, 16, 18, 48, 50, 64–67 and 80–83. No tile is rated 0, so no tile is impassable from its terrain value alone. This puts numbers on the sampled paces and replaces the two-value (road / off-road) reading of them.
