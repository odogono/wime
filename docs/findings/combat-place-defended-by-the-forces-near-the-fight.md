---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x04dde
  - disasm:code+0x04f3a
  - disasm:code+0x04f64
  - disasm:code+0x0f640
  - disasm:code+0x0e892
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 166
supersedes: places-defended-by-garrison-units
---

**A Place under attack is defended by whoever the fight's rows gather: every awake Leader within 9 pixels of the attacked Good Leader, with its followers. Nothing about the Place, its Garrisons or a destination enters the choice.**
The rows are gathered around the attacked Good Leader's own position (code+0x0f640), by the routine that lists the Forces near a spot (code+0x04dde; finding:combat-good-leaders-keep-rows-of-their-own). It tests only an entry's state, its Leader byte and its distance, 9 pixels on both axes (code+0x04f3a to code+0x04faa). It reads no Place, tile or terrain, and uses no wider reach at a Place. It reads the destination only when listing moving Forces for other callers (code+0x04f64), never for a fight. A Force near a Place but not on it defends it as well: at the start the infantry at the Rammas Forts, 8 pixels from Minas Tirith, joins every fight there alongside Denethor, his tower guards and the city's infantry.

A Garrison is just a Leader, or a follower, that stays put. A Leader with no destination is never moved (code+0x0e892), so a Garrison never starts a fight, but it fights whoever comes within reach. Since nothing else in the combat code depends on the Place (finding:combat-no-place-or-terrain-modifier), the manual's costlier assaults on fortresses, citadels and walled cities (finding:combat-defences) can come only from the Garrisons' starting stats. Many are higher than the same troops' in the field: the Evil citadels' orcs fight at 3 or 4 against 2, and Minas Tirith's tower guards at 4 against 2 for Gondor's infantry. That link is still an inference; no order of strength is coded.
