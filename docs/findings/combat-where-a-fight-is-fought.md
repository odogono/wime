---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0d036
  - disasm:code+0x0d07e
  - disasm:code+0x04e9c
  - disasm:code+0x0b5e6
  - observed:combat-faramir-go-there
issue: 45
---

**After "Go there", a fight whose Good side includes a Unit is fought in the combat window on the Campaign Level, and one with only Characters on the Animation Level.**
The Campaign Level loop builds the rows and tests whether any Good row is a Unit, or Elrond, entry 3 (code+0x0d07e, code+0x04e9c). If so, the view scrolls to the fight, the spot flashes, and the fight runs over the Campaign Level map. Otherwise the fight is handed to the Animation Level (code+0x0b5e6). In play Faramir, with 200 Rangers following him, was fought on the Campaign Level. Why Elrond counts like a Unit is not known. This fits the manual: fights that involve Characters are played out on the Animation Level (finding:combat-meeting-enemies-forces-a-fight).
