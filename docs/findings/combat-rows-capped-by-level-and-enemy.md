---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x04de6
  - disasm:code+0x04e10
  - disasm:code+0x05054
  - disasm:code+0x0506e
  - disasm:code+0x0523e
  - disasm:code+0x050ac
issue: 187
---

**A fight's sides hold at most 19 rows, 9 in a fight played on the Animation Level and 7 against a balrog; the Evil side stops only once it is over its cap, so it can hold one row more. Entry 78 is listed only on the Campaign Level.**
The routine that lists the Forces near a spot (code+0x04dde) sets its cap at 19, or at 9 when it runs on the Animation Level with a fight handed there (mode 3 and fight state 2, code+0x04de6). It lowers it to 7 when the fight's enemy has the balrog figure, 12 (code+0x04e10). The Good side is listed in full and then cut to the cap (code+0x0506e). The Evil side's loop goes on while it holds no more rows than the cap (code+0x0523e), so it ends with up to 20, 10 or 8 rows. Against Shelob, entry 151, she is the only Evil entry it looks at (code+0x050ac).

Good Leaders are taken from entries 1 to 78 on the Campaign Level, but from 1 to 77 anywhere else (code+0x05054); followers always come from 1 to 78.
