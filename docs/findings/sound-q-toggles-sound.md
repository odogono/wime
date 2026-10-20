---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x02066
  - disasm:code+0x02012
  - disasm:data+0x08ce
issue: 131
---

**Sound starts on, and Q, in either case, switches it off and on. Switching it off frees the piece playing; the setting is not saved.**
The flag at data+0x08ce is 1 in the data hunk. The key check (code+0x02066) masks the key with 0xdf, so q and Q both match 0x51, flips the flag and calls code+0x02012, which frees the current piece once it has stopped. With the flag off the loader loads no piece and the effect player plays nothing (finding:sound-score-and-effect-table, finding:sound-effects). The flag is a variable of the running game and is not part of the archive (finding:data-formats-save-file-archive-dat). finding:ui-key-bindings lists Q.
