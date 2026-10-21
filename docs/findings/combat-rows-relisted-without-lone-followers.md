---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x05078
  - disasm:code+0x05086
  - disasm:code+0x04d9a
issue: 187
---

**When a fight's Good side lists more than 19 rows, the list is made once more, dropping each follower Character whose own followers added no row; whatever is still over the cap is cut.**
After the Good Leaders are listed, a count over a cap of 19 sets a flag and the listing starts again (code+0x05078, code+0x05086). With the flag set, each follower that started a new row is taken off again when its starting strength is 1 and its own followers added no row after it (code+0x04d9a). The second listing is not repeated, and under the caps of 9 and 7 there is no second listing at all: the rows past the cap are simply cut. A dropped Character takes no part in the fight.
