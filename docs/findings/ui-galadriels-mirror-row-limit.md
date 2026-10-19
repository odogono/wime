---
kind: fact
topic: ui
confidence: provisional
sources:
  - disasm:code+0x04dde
  - disasm:code+0x05264
issue: 28
---

**Galadriel's Mirror probably lists at most 19 Good rows and about 19 Evil rows, and drops the rest without saying so.**
The list builder (code+0x04dde) caps the Good column at a limit of 19 outside the Animation Level, retrying once with its follow-up pass before cutting it, and stops adding Evil entries once that column passes the same limit. It also picks a row spacing of 8 or 9 pixels by how full the columns are (code+0x05264). How the window fits 19 rows of 9 pixels on a 200-line screen, and whether a full column was ever reached in play, has not been checked.
