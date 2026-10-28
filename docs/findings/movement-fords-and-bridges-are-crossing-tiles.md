---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:data+0x4242
  - disasm:data+0x3e76
  - resource:AMaps.res#MMAP 1
issue: 295
---

**A ford or a bridge is nothing more to movement than a map tile drawing a road over a river, rated 100; fords and bridges are not told apart, and the same tiles make unnamed crossings elsewhere on the map.**
Each named crossing in the Places table (data+0x3e76) stands on such a tile: Sarn Ford and Osgiliath on tile 71, the Ford of Bruinen and the Fords of Isen on tile 55, Stonebows Bridge on tile 142 and the Last Bridge on tile 222, each between river tiles rated 20 (finding:map-terrain-values-of-water-and-mountains). Pelargir stands on tile 60, another road over a river. Movement reads only the terrain value of a tile (finding:movement-greedy-tile-steering), and nothing in it tests a Place or a tile number, so a ford and a bridge carry a Force alike, at full pace. Tile 55 is placed at 15 spots and tile 71 at 5, most of them away from any named Place, and those carry a Force just as well. The manual's single crossings, the Fords of Isen for the Isen (finding:map-fords-of-isen-only-isen-crossing) and the Last Bridge for the Hoarwell (finding:map-last-bridge-only-safe-hoarwell-crossing), are the only road crossings of those rivers, not the only places a Force can get over (finding:movement-rivers-crossed-by-the-straight-step).
