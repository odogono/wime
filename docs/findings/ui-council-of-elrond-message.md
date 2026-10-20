---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0dc2a
  - disasm:code+0x0dce8
  - resource:BScene.res#CSTR 46
  - resource:BScene.res#CSTR 47
  - resource:BScene.res#CSTR 48
issue: 94
---

**The Council of Elrond is told in a 240 by 130 box with no buttons, which holds the game for 1200 frames.**
The box opens at (40, 20) (code+0x0dc2a). Its text is BScene.res CSTR 46 at (20, 20), "In the House of Elrond in Rivendell was held a great council, at which it was decided to attempt"; then at (20, 40) CSTR 47, "the destruction of the Ring, and ", followed by the Ring-bearer's name and " was"; then CSTR 48 from (20, 50), "appointed the Ring-bearer. The Companions of the Ring were then chosen, …" ending "For nearly two months the fellowship rests and recuperates." The name is the Ring-bearer's after the Council has changed it (finding:objects-council-gives-the-ring-to-gimli).

The routine then waits until the vblank count has gone up by 1200 (code+0x0dce8), 24 seconds, and closes the box. Nothing else runs meanwhile, so game time stands still and the player cannot dismiss it. The rest of the Council's changes follow the wait.
