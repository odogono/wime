---
kind: fact
topic: ui
confidence: observed
sources:
  - observed:galadriels-mirror
  - tool:tools/extract-font.ts#parseRomTopaz
issue: 124
---

**The Full Map Level's topaz/8 is Kickstart 1.3's, with its pointed A, not the squarer topaz of Kickstart 2.**
The text routine opens topaz/8 from the ROM (finding:ui-text-font-lord-10), so its look depends on the Kickstart. The two differ in 165 of their 224 glyphs: Kickstart 1.3's capital A comes to a point and its g has a rounder bowl, while Kickstart 2.04's A has a flat top. A capture of Galadriel's Mirror shows the pointed A in "The NAZGUL LORD". That capture ran under WHDLoad on a Kickstart 2.04 machine, but WHDLoad runs the game on the Kickstart 1.3 image it is given, so the game sees 1.3's fonts even there. Kickstart 1.3 leaves the TextFont's name pointer unset in the ROM, so tools/extract-font.ts finds it by its shape: 8 by 8, baseline 6, characters 32 to 255, flags ROMFONT and DESIGNED.
