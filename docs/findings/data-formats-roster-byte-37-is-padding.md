---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 171
supersedes: data-formats-roster-byte-19-is-figure-colour
---

**Byte 37, the last byte of a roster record, is padding: no instruction reads or writes it, and it is 0 in every entry. Every other byte has a settled meaning.**
Bytes 19, 24 and 29 are the figure's colour mapping, the magic flags and the evasion or meeting chance (finding:graphics-figure-colour-selectors, finding:combat-magic-weapons-and-protection, finding:combat-evasion-chance, finding:forces-encounter-figures-wait-in-areas). No instruction in the code hunk addresses byte 37: neither through the roster's address at byte 37 of entry 0, data+0x1e0d, nor at offset 37 from a record pointer. The record is 38 bytes long, so the byte keeps each record on an even address, as the 68000's word reads need. Only the Archive copies it, with the rest of the roster (finding:data-formats-archive-dat-is-roster-dump).
