---
kind: fact
topic: mobilisation
confidence: confirmed
sources:
  - disasm:code+0x0d4e8
  - disasm:code+0x0d762
  - disasm:code+0x0d28a
  - disasm:code+0x0e6d4
  - disasm:data+0x1e04
issue: 5
---

**Byte 28 of a roster entry is its allegiance: 0 is Evil, 1 is Good but not yet mobilised, and 99 is mobilised and under the player's command. A few entries have other values.**
A trigger turns 1 into 99 (code+0x0e6d4). The Full Map Level draws an Evil leader's dot in colour 10 and any other in colour 14, and skips an unmobilised leader with no trigger (code+0x0d4e8). A second pass makes the dots of leaders above 2 blink between colours 12 and 15 (code+0x0d762). The Campaign Level likewise blinks the icons of leaders above 2 (code+0x0d28a). This fits the manual's red, green and blinking blue dots (finding:ui-full-map-level-coloured-dots, finding:mobilisation-neutral-dots-are-unmobilised).

At the start, 99 is held by Gandalf, Aragorn, Frodo, Sam, Merry, Pippin, Legolas, Gimli, Éomer, Faramir, the four Rohan muster captains at Edoras, the five lords of the southern fiefs of Gondor, four of Gondor's Units and a band of Rangers. The other free peoples are 1. The other values are Boromir 70, Gollum 40, Elrond and the advisors 3, Glorfindel 4, and the Ents and Huorns 2. The code compares these against 1, 2, 3 and 4 in the Encounter and joining code (code+0x0f22c), which suggests a loyalty level, but that has not been traced.
