---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x00006
  - disasm:code+0x00396
  - disasm:code+0x0058e
  - disasm:code+0x00a72
  - disasm:data+0x0258
  - disasm:data+0x06b0
  - disasm:data+0x085a
issue: 80
---

**An Animation Level scene is not one picture: it is built afresh from layers of scenery strips chosen by the terrain of the map tile the watched Character stands on, partly at random.**
The builder at code+0x00006 composes a 320 by 200 bitmap (data+0x4ffc). It looks up the tile under the Character in a 256-word table at data+0x0258, the scene word (code+0x00396). Its low five bits pick one of 18 scenery lists at data+0x06b0. Each list holds groups of strips from AScene.res and BScene.res, far hills, middle distance, ground, each a full 320 pixels wide and of varying height. From each group one strip is picked at random, placed at a random x shifted by the Character's position within the tile times a parallax factor, and at a fixed or random height. A group may be marked optional, drawn one time in three (code+0x0058e). Bits 5 to 9 of the scene word add set pieces, and bits 10 to 15 a per-Place special scenery, through a switch on the tile at code+0x00d3c that is not yet decoded. Last, foreground pieces from BScene.res IMAG 300 to 317, rocks, bushes and trees, are scattered from data+0x085a (code+0x00a72).

So the same tile does not always look the same, and the full-screen-wide BScene.res IMAG 300 to 317 are foreground pieces rather than backdrops. In the south-east, from x 0x690 and y 0x3e0, the list index is remapped, and the Mount Doom area uses list 16 (code+0x00510).
