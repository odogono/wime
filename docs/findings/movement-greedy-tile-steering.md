---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0e994
  - disasm:data+0x421c
  - disasm:data+0x4227
issue: 10
supersedes: movement-rivers-block-route-finding
---

**Route-finding is a greedy tile-by-tile steering done only at tile-aligned positions: the entry scores each of the eight neighbouring tiles by its terrain value times a weight for pointing at the destination (100, 69, 39, 19 or 9 by angular distance), takes the best, and never searches further ahead.**
Between tile origins (both coordinates multiples of 16) the entry keeps its facing (code+0x0e994). At a tile origin it works out a desired facing from the signs toward the destination, dropping the x sign when twice the x distance is not greater than the y distance and the y sign when twice the y distance is less than the x distance, then looks the facing up in the table at data+0x421c. Once in ten times on average it instead takes the desired facing outright, but only if the next tile's terrain value is at least 10; otherwise it scores all eight facings starting from the desired one, dividing a score by 8 when the candidate is the reverse of the current facing, and keeps the first strict maximum. A quirk of the compiled comparison (the current facing plus 4 is never masked to 0–7) means the reverse penalty only applies when the current facing is north round to south-east (0–3). Rivers block in practice because a low-valued water tile straight ahead (terrain 5–20) scores under a bank tile to the side (39 × 60 on the plain), so a Force walks along the bank and loops, as observed with Éomer at the Entwash; nothing in the code marks river tiles impassable, or looks for a crossing beyond the eight tiles around the Force.
