---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0ed3c
  - disasm:code+0x0ed88
  - disasm:code+0x0ef56
  - disasm:code+0x0ef60
  - disasm:code+0x0efd0
  - disasm:code+0x0f028
  - observed:war-events-isen-ford-evil
  - observed:war-events-isen-ford-good
  - observed:war-events-mordor-good
  - observed:war-events-mordor-west
  - observed:war-events-mordor-evil
issue: 57
---

**The Isen Ford and Mordor tripwires are tested in a Leader's movement step whenever it lands on a tile origin: after any arrival at its destination and its next Default Orders destination, and before the search for an enemy to fight. They set their War Events and day silently, and only once.**
The movement step tests for a tile origin (both coordinates multiples of 16) after moving one pixel (code+0x0ed3c). If the Leader is at its destination it handles the arrival and takes its next destination (code+0x0ed88 to code+0x0ef56). Then, whether it arrived or not, an Evil Leader on (1104, 928) sets events 3 and 5 (code+0x0ef60; finding:mobilisation-evil-at-the-fords-of-isen). A non-Evil Leader on any tile origin with x ≥ 1664 and y ≥ 1008 sets event 7 (code+0x0efd0; finding:ai-good-force-near-mordor-starts-the-war). Only after that does the step look for Encounters and enemies (code+0x0f028). Each bit is set only if clear, and the day is recorded with it (finding:ai-war-events-set-once). Only Leaders move, so followers never trip them.

What follows is in finding:ai-trigger-tested-before-the-move and finding:ai-delayed-triggers-wait-for-hour-8:

- Gondor's event 3 triggers take effect within the sweep.
- The Rohan musters wait for the next 8 a.m.
- Event 7 brings events 3, 4 and 6 and "Saruman's army is on the march!" at the next 8 a.m. check, but never "The Dark Lord's armies march forth!", since the day-169 rule finds bit 7 set.

In play:

- Hand Orcs stepping east from (1103, 928) onto the ford set events 3 and 5 on day 10 at 12:30, with no message. The Rangers doing the same set nothing.
- Aragorn stepping onto (1664, 1008) set event 7. Onto (1648, 1008) he set nothing, and Hand Orcs onto (1664, 1008) set nothing.
