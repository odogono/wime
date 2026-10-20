---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - disasm:code+0x0a0ca
  - disasm:code+0x038e8
  - disasm:code+0x0bcf4
issue: 119
supersedes: data-formats-roster-bytes-19-and-37-unsettled
---

**Roster byte 19 selects the figure's colour mapping; byte 37 remains unsettled.** `spawnFigures` reads byte 19, passes it to `newFigure`, and the figure object carries it to the bitmap draw as its colour selector (finding:graphics-figure-colour-selectors). Gandalf starts with 4, Aragorn with 14, Boromir with 24 and Frodo with 5. This resolves the earlier claim that no code reads the byte. Byte 37 is always zero in the starting roster and may be padding.

The earlier identifications of byte 24 as magic flags and byte 29 as the evasion chance or Encounter chance still hold (finding:combat-magic-weapons-and-protection, finding:combat-evasion-chance, finding:forces-encounter-figures-wait-in-areas). The extractor's `unknown.b19` name is retained for compatibility with existing exports and saves.
