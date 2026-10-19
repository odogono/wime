---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0d502
  - disasm:code+0x0d762
  - disasm:data+0x4ac8
  - observed:full-map-at-start
issue: 28
supersedes: mobilisation-neutral-dots-are-unmobilised
---

**A Full Map dot's colour comes from its Leader's allegiance byte: red for Evil (0), green for allegiance 1 or 2, and a blinking cyan for anything above 2, which includes the player's mobilised Forces (99).**
The first pass (code+0x0d502) draws every dot in palette colour 10 (RGB4 0xF00, red) for allegiance 0 and colour 14 (0x2F3, green) otherwise. The blink pass (code+0x0d762) then redraws only the dots whose allegiance is above 2, alternating colour 12 (0x0FF, cyan, the manual's "blue") with colour 15 (0xFEB, the cream of the land, so the dot seems to vanish) (finding:data-formats-full-map-palette).

So green is not simply "unmobilised": it covers the unmobilised Good entries that wait on a trigger (allegiance 1) and the Ents and Huorns (2), while unmobilised entries with no trigger get no dot (finding:ui-full-map-dots-for-awake-leaders). Blinking is not only the player's: Elrond and the advisors (3), Glorfindel (4), Gollum (40) and Boromir (70) blink as well, if awake and leading (finding:mobilisation-allegiance-byte). In play at the start, Frodo's dot at Hobbiton flips between cyan and invisible and a Force east of Gondor blinks the same way.
