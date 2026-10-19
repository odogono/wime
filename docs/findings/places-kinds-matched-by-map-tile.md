---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:data+0x412e
  - disasm:code+0x0e398
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Place records 70 to 84 are not named Places but 15 generic kinds, such as "a small town" or "an evil citadel", each tied to one map tile; any point on one of those tiles is a Place of that kind. Named Places have no kind of their own.**
After the named Places, the game checks records 70 to 84, whose y field holds a tile number instead of a position. It matches the tile under the point against that number (code+0x0e398). The kinds are a ruined castle (tiles 11 and 26), a large town (13 and 45), a castle (28), a ruin (29), an evil citadel (44 and 77) and a small town (46, 60, 78, 79, 94, 125 and 174). No field of a named Place's record gives its kind. 28 of the 69 named Places stand on one of these tiles, so a kind can be inferred for them: the Hornburg and Edoras are castles, Minas Morgul, Cirith Ungol and Carach Angren evil citadels, Annúminas and Belegost ruins. The game itself always names such a point by its named Place.
