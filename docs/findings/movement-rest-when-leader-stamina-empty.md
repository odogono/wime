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

**A Force stops to rest when its Leader's stamina reaches 0, and its followers spend no stamina while following.**
Frodo, with 40 stamina, stops after 40 movement steps, first at (673, 384) on the road to Bree, while Sam and Pippin following him stay at 32/32 the whole way. Faramir stops after his 32 steps on the way to Osgiliath, and Éomer after his 40 west of East Emnet. This names the rest trigger that finding:movement-stamina-and-rest left untraced; its recovery and morning-resume rules hold as observed, with the resume falling at random inside the window (quarter-hours 36 to 38 in one run, 19 to 25 in another, always with stamina already full).
