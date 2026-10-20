---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0f070
  - disasm:code+0x0f228
  - disasm:code+0x0f376
  - disasm:code+0x0f84e
  - disasm:code+0x0fafe
  - observed:forces-meet-mobilised-characters
  - observed:forces-meet-mobilised-units
  - observed:forces-meet-an-advisor
  - observed:forces-meet-an-unmobilised-leader
  - observed:forces-meet-two-unmobilised
issue: 68
---

**When a moving Leader finds another Leader that is not Evil, it is a meeting, not a fight. The meeting happens only if one of the two has allegiance above 3, and what is offered depends on the other's allegiance: to follow it (above 3), to talk (3), or only to go there (1 or 2).**
The search is the one that finds fights (finding:combat-fight-starts-when-evil-meets-non-evil). The mover must have stepped onto a tile origin, and the other must be a Leader, moving or resting, within 7 pixels on both axes. When the other is not Evil (code+0x0f376), the code names the two parties A and B (code+0x0f228):

- If only one of them has allegiance above 3, that one is A.
- If both have, A is the one with the higher roster index.
- If neither has, A is the mover.

A meeting goes on only if A's allegiance is above 3 (code+0x0f84e). Two unmobilised Leaders pass each other without a word. B's allegiance picks the kind (code+0x0fafe):

- **Above 3:** the window offers A the chance to follow B (finding:ui-meeting-window).
- **3**, Elrond and the other advisors: B invites A to pause and talk, an Encounter on the Animation Level.
- **1 or 2**, an unmobilised Leader or the Ents and Huorns: the window offers only "Go there" or "Continue on".

Allegiance 40, Gollum's, counts as above 3, but Gollum meeting Frodo has its own message, " notices Gollum following.".

In play:

- Faramir (15) stepping onto Éomer (13) was offered to follow Éomer.
- Gondor infantry 72 stepped onto 73, and 73, the higher index, was offered to follow 72.
- Aragorn stepping onto Elrond was invited to talk.
- Faramir stepping onto Théoden, allegiance 1, got the plain window.
- Théodred, allegiance 1, stepping onto Théoden got nothing.
