---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x07eb0
  - disasm:code+0x08be0
  - disasm:code+0x08d12
  - strings:0x90d8
  - strings:0x92fb
  - strings:0x933d
  - strings:0x939d
  - strings:0x93f7
  - observed:full-map-at-start
issue: 28
---

**The scroll opens the Archive window, "Would you like to...", with two buttons, "Restore an old game" and "Save current game", and the game answers with one of four messages.**
The window (code+0x07eb0) sits at the top right of the Full Map, beside the icon column. The messages are:

- "No Archive file exists, you must save one before you may restore." when restoring finds no `A:ARCHIVE.DAT`.
- "The old game was restored successfully."
- "There was an error in saving the Archive file. Please check the disk drive and try again."
- "The game was successfully saved."

Each message is split over lines as shown in the executable. Saving writes data+0x1de8 to data+0x3e71, the roster and the game state, to the one file (code+0x08be0), and restoring reads it back (code+0x08d12) (finding:data-formats-save-file-archive-dat, finding:ui-single-save-slot). No message for a failed restore other than a missing file has been found.
