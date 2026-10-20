---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x071b6
  - disasm:code+0x0725e
  - disasm:code+0x07306
  - disasm:code+0x073b6
  - resource:BScene.res#CSTR 38
  - resource:BScene.res#CSTR 45
  - observed:objects-token-away
  - observed:objects-token-dain
  - observed:objects-token-theoden
  - observed:objects-token-denethor
  - observed:objects-token-denethor-again
  - observed:objects-token-thranduil
issue: 102
---

**A Token works only when used where the watched Character stands exactly on its awake ruler: Dáin for the Dwarven Ring, Théoden for the Red Arrow, Denethor for the sceptre and Thranduil for the silver orb. It sets the ruler's allegiance to 99 and clears his trigger; anywhere else it shows a hint and is kept.**
Each Token's case compares the watched Character's x and y with the ruler's and tests that the ruler's state is not 0, asleep.

| Token          | Ruler          | Also needs   | On success (BScene CSTR)                                                | Elsewhere (CSTR)                                                | Kept? |
| -------------- | -------------- | ------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------- | ----- |
| a Dwarven Ring | Dáin, entry 17 |              | "DAIN accepts your gift and swears support to your cause." (38)         | "Use the ring at Erebor to secure Dain's help." (39)            | no    |
| the Red Arrow  | Théoden, 26    |              | "THEODEN's hand trembles as he holds the black feathered shaft. …" (40) | "The Arrow is a token of war to who will obey." (41)            | no    |
| a sceptre      | Denethor, 32   | allegiance 1 | "Gazing upon the sceptre, DENETHOR spoke. …" (42)                       | "The Sceptre was the chief mark of royalty in Numenor." (43)    | yes   |
| a silver orb   | Thranduil, 22  |              | "Holding the Silver Orb, THRANDUIL spoke. …" (44); also wakes entry 62  | "The Orb was a gift from the Valinor to the sylvan elves." (45) | no    |

On success the ruler's allegiance, roster byte 28, becomes 99 and his trigger byte 0 (code+0x071b6, code+0x0725e, code+0x07306, code+0x073b6). The silver orb also sets entry 62, the elves waiting beside Thranduil, to state 1, allegiance 99 and trigger 0. Nothing else is changed: Dáin's following dwarves, entry 18, keep allegiance 1. The rest of a Nation follows through the War Events: Théoden at 99 sets event 5, which wakes the Rohan musters, and Denethor at 99 sets event 3, which wakes Gondor (finding:ai-war-events). No War Event watches Dáin or Thranduil.

So the manual's "King" of Gondor (finding:mobilisation-token-table) is Denethor. The sceptre is never used up, but once Denethor's allegiance is no longer 1, because of the sceptre or event 3, it only shows the hint.

In play: the Dwarven Ring used away from Erebor showed the hint and was kept. With Frodo written onto Dáin's position (1744, 224), it showed CSTR 38, Dáin's allegiance went 1 → 99 and his trigger 0x40 → 0, and the Ring was gone. The Red Arrow on Théoden and the orb on Thranduil did the same; the orb's entry 62 also became allegiance 99 with trigger 0. The sceptre on Denethor took him 1 → 99 (trigger 0x08 → 0) and was kept; used on him again it showed CSTR 43.
