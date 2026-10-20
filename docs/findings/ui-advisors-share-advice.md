---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0c3f6
  - disasm:code+0x0b7e0
  - disasm:data+0x1db0
  - disasm:data+0x1dd0
  - resource:BScene.res#CSTR 8
issue: 81
---

**The advisors do not have advice of their own: each draws a greeting, one tip and a farewell at random from one shared set of texts, and talking changes nothing in the game.**
On the Animation Level the advisor walks up to the party and speaks in three boxes (code+0x0c3f6):

1. A greeting: "Greetings ", "Hello ", "Welcome " or nothing (data+0x1db0), the watched Character's name, then one of BScene.res CSTR 0 to 3, such as ", this is well met! I have heard an odd tale.".
2. A tip, BScene.res CSTR 8 to 27 (code+0x0b7e0): where an object lies or healing may be found, such as "In the Old Forest east of Buckland is a stand of trees whose wood is prized by the wise.", or the lore of a Token. A table of 20 flags (data+0x1dd0) marks the tips already given, and the pick is rerolled up to 50 times to find a new one. The table is never cleared and is not saved, so each tip is given once in a session.
3. A parting, CSTR 4 to 8, such as "I must go now, but one last thing: ", then three times in four a proverb (CSTR 28 to 33) and otherwise another tip, and last "Farewell!", "Good luck!", "Good journey!" or "Goodbye!" (data+0x1dc0).

The talk sets no War Event and gives no Token or object. Círdan, Galadriel and Tom Bombadil appear as still pictures at the right of the scene; the others as walking figures.
