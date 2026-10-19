---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - disasm:data+0x1de8
  - disasm:code+0x0e420
  - disasm:code+0x0e72c
  - disasm:code+0x0d4c2
  - disasm:code+0x06e9c
  - disasm:code+0x0ebce
  - disasm:code+0x0d2e0
  - disasm:code+0x09f76
  - disasm:code+0x06cda
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Every Character and Unit is a 38-byte record in one roster table of 196 entries at data+0x1de8. Entry 0 is empty, and the table holds the whole starting state of each entry.**
The fields, by byte offset into the record, are:

| Offset | Size | Field                                                                           |
| ------ | ---- | ------------------------------------------------------------------------------- |
| 0      | 4    | pointer to the name                                                             |
| 4      | 2    | starting strength: 1 for an individual, the head count for a Unit               |
| 6      | 2    | current strength; 0 means dead or destroyed                                     |
| 8      | 4    | position, x then y, in Campaign Level pixels                                    |
| 12     | 4    | destination, x then y; 0,0 for none                                             |
| 16     | 2    | objects carried, one bit per object                                             |
| 18     | 1    | Campaign Level icon                                                             |
| 20     | 1    | Animation Level figure                                                          |
| 21     | 1    | facing, 0 to 7 clockwise from north                                             |
| 22     | 1    | state: 0 asleep, 1 moving, 3 resting; 2 is skipped by the main loop             |
| 23     | 1    | fighting strength                                                               |
| 24     | 1    | magic flags: bit 0 a magic weapon, bit 1 magic protection                       |
| 25     | 1    | maximum health                                                                  |
| 26     | 2    | current health                                                                  |
| 28     | 1    | allegiance                                                                      |
| 29     | 1    | evasion chance out of 100                                                       |
| 30     | 1    | wake condition                                                                  |
| 31     | 1    | speed class, 0 to 5                                                             |
| 32     | 1    | fraction of a pixel moved; for Encounter figures, the first day they can appear |
| 33     | 1    | maximum stamina; 255 never tires                                                |
| 34     | 1    | current stamina                                                                 |
| 35     | 1    | leader, as a roster index; 0 for none                                           |
| 36     | 1    | Default Orders route, as a row of the route table                               |

Bytes 19 and 37 are not settled (finding:data-formats-roster-bytes-19-and-37-unsettled); bytes 24 and 29 are read by the fight code (finding:combat-magic-weapons-and-protection, finding:combat-evasion-chance). Entries 152 to 195 reuse bytes 8 to 15 and 29 for Encounters (finding:forces-encounter-figures-wait-in-areas). The code reads a field either as `lea <table base + offset>(a4)` plus the index times 38, or through a pointer to the record. Each meaning comes from the code that reads the field, such as the main loop (code+0x0e72c), the Full Map dots (code+0x0d4c2), the Campaign Level icons (code+0x0d2e0) and healing (code+0x06e9c); `docs/re/starting-state-tables.md` gives the address for every field.
