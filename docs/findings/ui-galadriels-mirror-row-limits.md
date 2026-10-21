---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x07dd0
  - disasm:code+0x07e08
  - disasm:code+0x04de6
  - disasm:code+0x04c8a
  - disasm:code+0x05078
  - disasm:code+0x0523e
issue: 171
supersedes: ui-galadriels-mirror-row-limit
---

**Galadriel's Mirror lists at most 19 Good rows and 20 Evil rows. Too many Good rows are listed again without lone follower Characters, then cut; a follower merges only with a row of its own Leader's; the rest is dropped without a word.**
The Mirror lists the Forces on the move with the routine that gathers a fight's rows, in its mode for listing moving Leaders anywhere (code+0x07dd0; finding:combat-rows-capped-by-level-and-enemy). So the caps are a fight's: 19 rows a side, the Good side listed once more without each follower Character whose own followers added no row, then cut to 19 (code+0x05078; finding:combat-rows-relisted-without-lone-followers), and the Evil side stopping only once it has more than 19, at 20 (code+0x0523e). Followers come recursively, and in this mode a follower joins only a row whose first entry has the same Leader, as well as the same name (code+0x04c8a). Off the Campaign Level the Good Leaders are entries 1 to 77.

The window is 24 pixels deep plus 9 for each row of the longer column, at y 5 (code+0x07e08), so 20 Evil rows make a box 204 deep, past the foot of the 200-line screen. The cap is lowered to 7 when the last fight's enemy was a balrog, since the routine reads that enemy even when no fight is on (code+0x04de6), so after such a fight the Mirror lists at most 7 Good and 8 Evil rows. Whether a full column was reached in play has not been checked.
