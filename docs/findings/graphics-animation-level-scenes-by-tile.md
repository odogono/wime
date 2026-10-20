---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x00006
  - disasm:code+0x001e6
  - disasm:code+0x00396
  - disasm:code+0x0058e
  - disasm:code+0x00a12
  - disasm:data+0x0258
  - disasm:data+0x06b0
  - disasm:data+0x085a
  - observed:animation-level-opening
issue: 87
supersedes: graphics-animation-level-scene-layers
---

**An Animation Level scene is built from layers of scenery strips chosen by the map tile the watched Character stands on, with random numbers seeded from that tile, so a tile always shows the same scenery.**
The builder at code+0x00006 seeds the game's generator from the watched Character's tile, (y ÷ 16) × 65536 + x ÷ 16 (code+0x001e6), and composes a 320 by 200 bitmap. Only the clouds, drawn before the reseeding, vary from visit to visit (finding:graphics-animation-level-sky-by-hour).

The scene word of the tile under the Character's centre (data+0x0258) picks everything (code+0x00396):

- **Bits 0 to 4** pick one of 18 scenery lists (data+0x06b0), each a list of groups. A group's header holds an optional flag (drawn one time in three), a parallax factor and a count; one strip is picked from it at random. A strip's id word is also its placement: bits 7 to 13 are its y, fixed if bit 14 is set and otherwise a random height below it. Its x is random(320) less the parallax factor times how far the Character is into its tile, doubled and counted from the far side when facing west. A strip with bit 15 set is a full-width strip drawn twice, 320 apart, so it covers the screen however it is shifted. Every strip is mirrored one time in two (code+0x0058e).
- **Bits 10 to 15**, on a tile origin only, add the scenery of a particular Place (finding:graphics-animation-level-place-scenery).
- **Bits 5 to 7** add a set piece, such as the bridge below Hobbiton (BScene.res IMAG 23078); on a tile origin the first three stand alone with no foreground (code+0x006ac). **Bits 8 and 9** add a river (IMAG 0x5629, code+0x008e0).
- Last, rocks, bushes and trees from BScene.res IMAG 300 to 317 are scattered in rows from a ground line at y 128 down to 162, with the generator reseeded from the tile and the position within it (code+0x00a12).

In the south-east, from x 0x690 and y 0x3e0, the lists are remapped and the sky is darker; around Mount Doom the list is always 16 (code+0x004bc). Built this way, Frodo's starting tile gives the captured opening scene: Hobbiton's houses on the hill, the stream and the bridge.
