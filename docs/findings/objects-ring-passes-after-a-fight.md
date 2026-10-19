---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x130a0
  - disasm:code+0x13114
  - disasm:code+0x1327a
  - disasm:code+0x131a8
  - disasm:code+0x1322c
  - disasm:code+0x13350
  - disasm:code+0x133bc
  - disasm:code+0x1342c
issue: 45
---

**When the Ring-bearer dies in a fight, the winners take the Ring: a living Hobbit if Good wins, or another Character if there is none. If Evil wins, the new bearer sets off for Barad-dûr and the other Nazgûl scatter.**
The dead bearer drops the Ring at the fight (finding:objects-dead-drop-their-objects), and the end of the fight hands it on (code+0x130a0).

- **Good wins:** the first living Hobbit in the Good rows takes it (code+0x13114). With no Hobbit, the last-listed living Character takes it; with no Character, a Unit. Gollum takes it only if nobody else is left (code+0x1327a).
- **Evil wins:** the last-listed Evil row takes it (code+0x131a8). If the winner was an Encounter rather than a Force, the 3rd Nazgûl is brought to the spot to take it, with the message "The 3rd NAZGUL is sent to the site." (code+0x1322c).

Either way the message is "<name> now has the RING." (code+0x13350). An Evil bearer is given Barad-dûr as its destination and loses its Default Orders (code+0x133bc). Every other awake Nazgûl is sent to Dol Guldur, the Morannon or Minas Morgul, chosen at random with Minas Morgul twice as likely (code+0x1342c). This answers finding:objects-new-ring-bearer-on-death.
