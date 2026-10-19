---
kind: lesson
topic: analysis
confidence: confirmed
sources:
  - strings:0x9432
  - strings:0x9478
  - strings:0x9a7d
  - strings:0x9dbf
  - tool:tools/extract_text.py#extract_embedded_strings
issue: 5
---
**A printable-string scan of the executable finds the Character rosters, Unit Types and Place names laid out in order in its data, which points to where the starting-state tables live.**
From about 0x941a the scan shows Good Characters, each followed by the Unit Type of the Units they lead (GLORFINDEL at 0x9432, then EOMER and `cavalry` at 0x9478, DENETHOR with `tower guards` and `infantry`). Leaderless Good Units follow, then Gollum, the nine Nazgûl and Evil Units, then advisors such as Tom Bombadil, the anonymous figures met in Encounters ("a Ranger", "a wanderer") and creatures. The Place names run from ANNUMINAS and HOBBITON (0x9a7d) to RAMMAS FORTS, followed by a list of Place kinds such as "a small town" (0x9dbf), "a ruin" and "an evil citadel". The tables that give each entry its position, strength and Default Orders are most likely next to or indexed alongside these names, so this region is the place to start disassembly for the starting state.
