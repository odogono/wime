---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e0c0
  - disasm:code+0x0dbbe
  - disasm:code+0x129dc
  - observed:war-events-gandalf-killed
  - observed:war-events-gandalf-asleep
issue: 57
---

**The two Gandalfs are roster entries 1 and 2. When entry 1 is asleep with an empty trigger byte, the next 8 a.m. check sets event 1, and entry 2, the second Gandalf waiting at Lórien, wakes in that same sweep. In play only death puts entry 1 in that state.**
Entry 1 starts asleep at Rivendell, waiting for event 6 (trigger 0x40). He is woken either by that trigger or by the Council of Elrond, which sets his state to 1 and clears his trigger (code+0x0dbbe). From then on, the only code that sets his state back to 0 is the loss of a fight, which zeroes the strength and state of an entry that runs out of strength or health (code+0x129dc). The daily check tests state and trigger only, not strength (code+0x0e0c0). Event 1 records no day and shows no message.

Entry 2, "GANDALF'", starts asleep at Lórien (1344, 656) with trigger 0x02, allegiance 99 and a route of Lórien alone. Waking him sets his state to 1 and his destination to Lórien. Nothing else changes, but from then on he also counts for the Gandalf proximity trigger (finding:ai-trigger-distances-are-square).

In play, entry 1 dead (strength 0, state 0, trigger 0) at 7:45 on day 10 gave event 1 at 8:00 and woke entry 2 in that sweep. Entry 1 merely asleep with trigger 0 did the same, which the game itself never produces. With entry 1 in his starting state nothing happened.
