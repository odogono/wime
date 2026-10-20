---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x070bc
  - disasm:code+0x0711a
  - disasm:code+0x07136
  - disasm:code+0x0716a
  - disasm:code+0x0b7e0
  - resource:BScene.res#CSTR 37
  - observed:objects-use-palantir
  - observed:objects-use-palantir-again
issue: 102
---

**Using the Palantír shows "Looking deep into the crystal, <name> sees a vision:". If War Event 7 has not happened, 69 times in 100 the vision is of the Nazgûl and War Event 7 starts that day; otherwise the vision is one of the advisors' tips. The Palantír is never used up.**
The code (code+0x070bc) opens the box and draws random(100) (code+0x0711a). Above 30, with event bit 7 clear, it sets bit 7, records the day as event 7's day (code+0x07136; finding:ai-war-events-set-once), and shows BScene CSTR 37: "A dark sky, tall battlements, and tiny stars … One flies straight toward you, getting bigger and bigger....". Otherwise (code+0x0716a) it shows a tip drawn the way an advisor draws one (code+0x0b7e0; finding:ui-advisors-share-advice), marked as given, from BScene CSTR 8 to 27.

Setting bit 7 is the Dark Lord's war: at the next 8 a.m. check events 3, 4 and 6 follow with "Saruman's army is on the march!", but "The Dark Lord's armies march forth!" is never shown (finding:ai-war-events, finding:mobilisation-tripwires-follow-arrival). The Palantír has no other effect, and the manual's warning is BScene CSTR 27: "The Palantir may give one second sight, but at a price!".

In play on day 0, Frodo used a Palantír: the vision of the nine, event mask 0x05 → 0x85, event 7 day 0, the Palantír still carried. Used again, it showed "South of Mount Gram, a band of Orcs being pursued by Rangers cast aside their spoils." and changed nothing.
