---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - tool:tools/extract-graphics.ts#AmigaOFSImage
---

**Disk.1 and Disk.2 are AmigaDOS Original File System (OFS) disk images made of 512-byte blocks, and files are rebuilt by following each file header's list of data blocks.**
An image must be a whole number of 512-byte blocks and start with the bytes `DOS`. All fields are big-endian 32-bit values. A file header block has type 2 at offset 0 and secondary type -3 at offset 508. It holds the file size at offset 324, the file name as a length byte at offset 432 followed by the name at 433, up to 72 data block pointers in the table from offset 24 to 311, and a pointer to the next extension block at offset 504. Extension blocks (type 16) continue the pointer table in the same layout. Each data block has type 8 at offset 0, its sequence number at offset 8, the number of data bytes at offset 12, and the data itself from offset 24 (up to 488 bytes).

The tool sorts the data blocks by sequence number before joining them, then trims to the file size. It does not walk directories: it scans every block for file headers and looks names up without regard to case.
