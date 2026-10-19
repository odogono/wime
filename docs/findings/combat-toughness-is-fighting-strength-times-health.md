---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x11290
  - disasm:code+0x1143e
  - disasm:code+0x11566
  - disasm:code+0x1158e
  - disasm:code+0x11cb2
  - disasm:code+0x11e52
  - observed:combat-eomer-dies-ignored
issue: 45
---

**One member of a row falls to a blow of its fighting strength × current health. A Unit loses members; a Character is either killed or wounded, losing health.**
The toughness T of one member is byte 23 × bytes 26–27 (code+0x11290). Units have a health of 1, except some at 2 or 3 such as elves. The enemy's ordinary blows are shared out between a side's unprotected rows in proportion to their head count. A row loses its share ÷ T members, up to its whole strength (code+0x1158e). Whatever is left then falls on the unprotected rows in list order (code+0x11cb2).

Only a row that started the fight at strength 1, a Character, can be wounded (code+0x1143e, code+0x11e52). A Character whose share is less than T loses share ÷ F points of health. A wound that would take all its health kills it instead (code+0x11566). Wounds are written to the roster at once; Units never lose health.

In play Éomer, with fighting strength 10 and health 5, was left at health 1 before 178 orcs killed him. He died with that 1 point still recorded.
