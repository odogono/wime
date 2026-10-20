---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x18f02
  - disasm:code+0x19b64
  - disasm:code+0x19a4a
  - disasm:code+0x19a64
  - disasm:code+0x19580
  - strings:0x19126
issue: 130
---

**The game plays its music with the Aegis Sonix Music Driver built into its own code, the same driver that the UADE and nuade players reproduce.**
The code hunk holds the driver's chunk names, "SHDR", "INS1", "TRAK" and "SNX1" (around code+0x19126), and its instrument loader (code+0x18f02). The loader opens `<name>.instr`, reads its first 0x20 bytes and walks a list of techniques at code+0x19b64 to find the one that reads the rest: "Synthesis", "SampledSound" (code+0x1a168) and "FORM" (code+0x1a4e4). The driver's tables are there byte for byte. The 12 semitone ratios from 0x8000 to 0x43CE are at code+0x19a4a, the 128-entry tempo table from 0xFA83 to 0x1000 at code+0x19a64, and the 16 note lengths (32, 16, 8, 4, 2, then dotted 48, 24, 12, 6, 3) at code+0x19580. These match the Sonix Music Driver as ported in nuade's `players/sonix/sonix.c`, which follows the driver's 68000 code, so its reading of the formats can be checked against the game's.
