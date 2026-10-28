---
kind: fact
topic: map
confidence: confirmed
sources:
  - disasm:data+0x4242
  - resource:AMaps.res#CHAR 1
  - resource:AMaps.res#MMAP 1
issue: 295
---

**The terrain table rates river tiles 20, sea, lake and coast tiles 5, the high mountains 10 and their edges 15; every tile where a road crosses a river is rated 100.**
The table at data+0x4242 gives each tile number its terrain value (finding:movement-terrain-percent-scales-pace). Matching the values against the tile pictures in CHAR 1 sorts them by kind. The 5s, tiles 0, 16, 18, 48, 50, 64–67 and 80–83, are open water and the coast tiles that are mostly water. The narrow river tiles drawn over grass, such as 7, 8, 9, 23, 25, 39, 40, 41 and 56, are rated 20, along with the river bends, mouths and marsh edges that carry less water. Mountain tile 113, the commonest after the plain and the sea, is rated 10, and the mountain edges 131, 146, 147 and 162 are rated 15. The tiles that draw a road across a river, 55, 60, 63, 71, 142 and 222, are rated 100 like the road itself, so a crossing is as quick as the road on either side.
