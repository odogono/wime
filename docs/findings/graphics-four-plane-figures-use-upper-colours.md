---
kind: fact
topic: graphics
confidence: provisional
sources:
  - resource:BScene.res#FRML 0
  - observed:animation-level-opening
issue: 80
---

**The 4-plane figure sets of the Free Peoples look right only in the upper 16 colours of the Animation Level palette, and are probably recoloured per Character.**
Decoded in colours 0 to 15, BScene.res FRML 0 to 4 and 8 are blue and grey. Shifted to colours 16 to 31 (finding:graphics-animation-level-palette) they show skin, hair and clothes: a hobbit, an elf, a man, a dwarf, a wizard and a cloaked figure. In the opening capture Frodo, Sam and Pippin, all from the hobbit set, wear different colours, so the game probably maps the 16 colours per Character when drawing. The figure object keeps roster byte 19 (code+0x038f6), a likely key. Neither has been traced.
