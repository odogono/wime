---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0d452
  - disasm:code+0x0d4c2
  - disasm:code+0x0d718
  - observed:full-map-at-start
issue: 28
---

**The Full Map Level draws one 3 by 2 pixel dot for each awake Leader among roster entries 1 to 151, at its Campaign Level position divided by 4 across and by 8 down.**
The drawing loop (code+0x0d4c2) runs from entry 151 down to 1, so Encounter figures (152 onwards) never get a dot. It skips an entry that is asleep (byte 22 is 0) or that follows a Leader (byte 35 is not 0), so a whole Force shows as its Leader's dot. It also skips a Good entry that is not mobilised (allegiance 1) and has no trigger (byte 30 is 0): a Nation that is waiting for its Token has no dot at all until mobilised. Dead entries are not tested directly; they are put to sleep when they die. The map is 640 by 200, so dividing Campaign Level pixels by 4 and 8 gives the Full Map's hi-res, 200-line pixels.

At the start of the game this gives the dots seen in play: the red Nazgûl around the Shire, Frodo's blinking dot at Hobbiton, and green dots for the Nations that wait on a trigger (finding:ui-full-map-dot-colours).
