---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - resource:Disk.1#title.smus
  - resource:Disk.2#frodo.smus
  - tool:tools/extract-sound.ts#parseScore
  - disasm:code+0x196bc
issue: 130
supersedes: sound-smus-music-files
---

**Every score is an IFF SMUS file as Sonix writes it: an SHDR header, a NAME, an SNX1 chunk, an INS1 chunk for each instrument it uses and four TRAK chunks, one for each Amiga voice. Each track is a list of 16-bit words: notes with a length, rests, instrument changes and tempo and volume commands.**
All 25 `.smus` files on the two disks decode this way (finding:sound-game-carries-the-sonix-driver), 3,550 notes in all:

- SHDR: a 16-bit tempo word (0x222d for `frodo.smus` up to 0x951a for `rohanians.smus`), a volume byte (127 in every score) and the track count (always 4).
- NAME: the piece's name, such as "TITLE.22" or "TITL.B".
- SNX1: Sonix's own settings. The first word transposes every note by its value shifted right 4 bits, less 8 (code+0x196bc), so 0x80 to 0x8f all mean none; the game's scores use 0x80, 0x81 (`longmajorevil.b.smus`) and 0x88 (`title.smus`, `fortress.smus`), and none is transposed. The four longwords from byte 8 say which voices play notes.
- INS1: an instrument's register number, 0 to 63, and its name. The name is the instrument file without `.instr`, such as "Snaredrum" or "The Pleiades".
- TRAK: the events. A word whose high byte is below 0x80 is a note, the high byte its pitch and the low nibble its length, through the table of note lengths: 0 to 4 are 32, 16, 8, 4 and 2 beats and 8 to 12 are the dotted 48, 24, 12, 6 and 3. 0x80 is a rest with the same lengths, 0x81 selects the instrument register in its low byte, 0x82 sets the tempo control and 0x84 the voice's volume. 0xffff ends the track. A note holds for three quarters of its length and is released for the rest. The word 0x8300 appears 100 times; the driver drops it with the other unknown commands.
