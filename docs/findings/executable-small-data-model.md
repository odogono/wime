---
kind: fact
topic: executable
confidence: confirmed
sources:
  - disasm:code+0x1b022
  - disasm:code+0x1afb0
  - tool:tools/extract-starting-state.ts#parseHunkFile
issue: 5
---

**The executable has three hunks: 114,708 bytes of code, a 23,044-byte data hunk of which the first 20,260 bytes are initialised, and a 4-byte BSS hunk. The code reaches all its data through register A4, which points 0x7ffe bytes into the data hunk.**
The startup code loads A4 with the data hunk's address plus 0x7ffe (code+0x1b022) and clears the uninitialised tail of the data hunk (code+0x1afb0). This is the small-data model of the Aztec C compiler. So a 68000 instruction such as `lea -$6216(a4),a0` refers to data+0x1de8, and every table the game reads appears in the disassembly as an A4 offset. The string literals are in the code hunk; the data hunk's tables point to them through relocated 32-bit pointers. The first 600 bytes of the data hunk are a jump table of 100 `jmp` instructions, so a call such as `jsr -$7dac(a4)` goes through data+0x0252.
