---
kind: fact
topic: movement
confidence: observed
sources:
  - observed:hobbiton-to-bree
  - observed:north-ithilien-to-osgiliath
  - observed:east-emnet-to-edoras
issue: 6
---

**Giving an Order by clicking in a Place's tile sets the destination to that Place's own position, not to the pixel clicked.**
Clicking near Bree set the destination (784, 384), Bree's Place position, which finding:map-positions-are-campaign-pixels notes is one tile west of the town graphic, and the Force sets out for that pixel. The same snapping gives Osgiliath's (1632, 1184) for Faramir and Edoras' (1248, 992) for Éomer. This is how the destination-only Orders of finding:movement-destination-only-orders land exactly on a Place.
