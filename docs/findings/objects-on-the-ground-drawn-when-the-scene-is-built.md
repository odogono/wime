---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x0aada
  - disasm:code+0x0ab82
  - disasm:code+0x0abd8
  - disasm:code+0x0ac18
  - disasm:data+0x4346
  - resource:BScene.res#IMAG 50
issue: 162
---

**When an Animation Level scene is built, each placement slot whose x and y equal the watched Character's position adds the object's picture, BScene.res IMAG 50 plus the object's number, with its top-left at x 200 + random(40) and y 165, at depth 0x99, up to six pictures.**
The scene routine (code+0x0aada) first frees the object pictures of the last scene (data+0x52e2, counted by data+0x52e0), builds the scenery, then walks the 30 slots of data+0x3db0 (code+0x0ab82; finding:objects-starting-placements). A slot counts only when both its coordinates equal the watched Character's roster x and y (code+0x0abac, code+0x0abcc): there is no distance, so an object shows only in scenes at its exact spot, and a slot cleared by Take (x 0) never matches. The picture is the IMAG named by byte 4 of the object's 8-byte record (data+0x4346), which runs 50 to 65 for objects 0 to 15; those IMAGs are in BScene.res. It is placed at x 200 + random(40) and y 165 (code+0x0abd8), the y being the top of the picture, so it lies just below the feet of the front row of figures. Byte 6, the depth the figures are sorted by, is 0x99, between the Good rows at 0x96 + row (finding:ui-animation-level-figures-walk-off); byte 7, its button, is 0x99 plus the object (code+0x0ac18), so clicking it names the object (finding:objects-lying-on-the-ground-are-pictures). The loop stops at six pictures, so a seventh object at the same spot is not drawn. The pictures are rebuilt with every scene, at a new random x.
