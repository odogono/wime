---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:code+0x0e342
  - disasm:code+0x048ae
  - disasm:code+0x0f74c
  - disasm:code+0x0b06a
  - disasm:data+0x3e72
issue: 200
---

**The original never names the kind of a named Place: wherever it shows a Place, it prints only the first field of the Place's record, which for a named Place is its name and for records 70 to 84 is the kind ("a small town").**
Every lookup of the Place at a point goes through `placeAt` (code+0x0e342), which returns a record number from 1 to 84 (finding:places-kinds-matched-by-map-tile). Its callers use the record in two ways only. The Force's status line ("at …", "heading …", code+0x048ae) and the attack report ("… is being attacked by …", code+0x0f74c) print the record's name pointer, the 4-byte field at offset 0 of the Places table (data+0x3e72). The attack test (code+0x0b06a, code+0x0f722) reads bit 0 of the grid byte. The other callers (code+0x057c0, code+0x0edb2, code+0x0ef06) test only whether there is a Place, or compare its number with particular Places. No code reads a kind for records 1 to 69, and the table has no field for one. So a named Place shows no kind, and a point on a generic tile away from a named Place reads as "at a small town". A port need not, and should not, invent a kind for a named Place.
