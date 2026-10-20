---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x06994
  - observed:hobbiton-to-bree
  - observed:north-ithilien-to-osgiliath
  - observed:east-emnet-to-edoras
issue: 71
supersedes: movement-destination-snaps-to-place
---

**An Order's destination is the clicked spot rounded down to its tile origin; the Order code never looks up a Place.**
The Order code (code+0x06994) adds the map's scroll offset (data+0x08c8, data+0x08ca) to the pointer position (data+0x5026, data+0x5028), adjusted by two bytes taken from the pointer image (data+0x5024, data+0x5025), and masks each axis with $fff0, a tile origin. A Place's position is its tile's origin (finding:map-positions-are-campaign-pixels), so a click in a Place's tile lands exactly on the Place. That is why clicking near Bree, Osgiliath and Edoras set (784, 384), (1632, 1184) and (1248, 992), which looked like snapping to the Place. The exact pointer adjustment is not yet worked out, so which tile a click near a tile edge picks may differ by one.
