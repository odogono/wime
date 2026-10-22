---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0c3f6
  - disasm:code+0x0c498
  - disasm:code+0x0b7e0
  - disasm:code+0x0b8d2
  - disasm:data+0x1db0
  - disasm:data+0x1dc0
  - disasm:data+0x1dd0
  - resource:BScene.res#CSTR 8
issue: 169
supersedes: ui-advisors-share-advice
---

**An advisor speaks in two boxes drawn from one shared set of texts, a greeting with a tip and then a parting, and talking changes nothing in the game.**
The advisors have no advice of their own. Event 0x0c of the advisor's script (code+0x0c3f6) opens a box at (10, 5), 256 wide and 56 high. Its first line is "Greetings ", "Hello ", "Welcome " or nothing (data+0x1db0), the watched Character's name and one of BScene.res CSTR 0 to 3, such as ", this is well met! I have heard an odd tale."; its second is a tip, BScene.res CSTR 8 to 27: where an object lies or healing may be found, or the lore of a Token.

Event 0x0d (code+0x0c498) replaces it with the parting: one of CSTR 4 to 7, such as "I must go now, but one last thing: ", then a proverb (CSTR 28 to 33) three times in four and otherwise a tip, and last "Farewell!", "Good luck!", "Good journey!" or "Goodbye!" (data+0x1dc0).

The tip picker (code+0x0b7e0) rolls one of the 20 tips up to 50 times while the roll's flag in a table at data+0x1dd0 is set, then takes the last roll, given or not, and sets its flag. So once all 20 have been given, tips repeat. For the parting the tip is picked, and its flag set, before the one-in-four choice (code+0x0b8d2), so a parting that shows a proverb still spends a tip. The table is never cleared and is not saved. The talk sets no War Event and gives no Token or object.
