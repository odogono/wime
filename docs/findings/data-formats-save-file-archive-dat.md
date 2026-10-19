---
kind: fact
topic: data-formats
confidence: provisional
sources:
  - strings:0x9381
  - tool:tools/extract-graphics.ts#AmigaOFSImage
---
**The single save slot is probably the file `ARCHIVE.DAT` on Disk 1.**
The executable names `A:ARCHIVE.DAT` right before its save messages ("The game was successfully saved." and an error about saving the Archive file), and Disk 1 holds an 8,330-byte file of that name. This matches the manual's one save slot, reached through the archive icon. The file's layout has not been examined.
