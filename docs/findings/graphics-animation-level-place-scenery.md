---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x00d3c
  - disasm:code+0x01f0e
  - disasm:data+0x08a2
  - observed:animation-level-opening
issue: 87
---

**Particular Places have scenery of their own, drawn when the watched Character stands on the Place's tile origin: a switch on the tile byte adds 31 kinds, from Hobbiton's houses to the towers of Barad-dûr.**
When bits 10 to 15 of the scene word are set and the Character is exactly on a tile origin, the builder calls code+0x00d3c, which draws random(3) and switches on the tile byte (dispatch at code+0x01f0e). Most cases replace the last strip so far with far hills and add a picture and a ground strip: the towns of the Shire, Bree and Gondor's coast share houses (BScene.res IMAG 204, 205) or a pair of cottages (201), with Hobbiton's own third house (216); Edoras, the Hornburg and Dol Amroth a castle on a hill (211); Barad-dûr, Minas Morgul, Cirith Ungol and Carach Angren a dark tower (203); and so on for Isengard (202), the White Towers (218), Weathertop (207), Dol Guldur (200), the Morannon (210), Lórien (214), Minas Tirith (212), Tom Bombadil's house (213), the Dimrill Dale (215), the ruined cities (220) and the orc holds (206). Rivendell and Mount Doom start the list afresh. Some cases also move or remove the foreground's ground line and set the music. Unless a case says otherwise, one more far strip from data+0x08a2 follows at x −160.
