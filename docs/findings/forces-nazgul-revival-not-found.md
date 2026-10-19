---
kind: fact
topic: forces
confidence: provisional
sources:
  - disasm:code+0x129d4
  - disasm:code+0x131d8
  - disasm:code+0x0dbee
  - manual:pdf-p12
issue: 45
---

**No code has yet been found that brings a killed Nazgûl back, apart from the 3rd Nazgûl being sent to take the Ring from an Encounter.**
A Nazgûl killed in a fight is recorded like anyone else, with strength and state 0 (code+0x129d4). An ignored fight only words it differently: "has been driven from the field." (finding:combat-ignored-fight-resolved-at-once). The trigger can't wake an entry with no strength left (finding:ai-trigger-conditions). The only write found to a Nazgûl's strength is the 3rd Nazgûl's revival when an Encounter has won the Ring (code+0x131d8; finding:objects-ring-passes-after-a-fight). The Council of Elrond puts the Nazgûl to sleep but leaves their strength alone (code+0x0dbee). So the manual's Nazgûl that "reappear later in Mordor" (finding:forces-nazgul-reappear-in-mordor) either work some way not yet traced or don't happen in the Reference Build.
