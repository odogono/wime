---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - disasm:code+0x18f80
  - disasm:code+0x19b76
  - disasm:code+0x1a168
  - disasm:code+0x1a396
  - disasm:code+0x1a3e4
  - tool:tools/extract-sound.ts#parseInstrument
issue: 130
---

**An instrument file is one of three kinds, named by its first 0x20 bytes: a 502-byte synthesised instrument ("Synthesis" or empty), a 0x60-byte "SampledSound" header naming a `.ss` sample, or an IFF 8SVX sample.**
The loader reads the first 0x20 bytes and picks the technique whose name they match, an empty name taking the first, "Synthesis" (code+0x18f80; finding:sound-game-carries-the-sonix-driver). The two disks hold 52 instrument files:

- Synthesis, 34 files: the technique reads 0x1d6 more bytes (code+0x19b76), 502 in all. The instrument's name is at 0x24 and the 128-byte waveform it starts from at 0x44. What the rest holds is finding:sound-synthesis-instrument-fields. Only `himalayas22.instr` spells out "Synthesis"; the others leave the name empty.
- SampledSound, 12 files of 128 bytes: the technique reads a 0x60-byte header (code+0x1a168). The name is at 0x24 and the `.ss` file to load, without its extension, at 0x44 ("Piano", "Trumpet", "Snaredrum", "BassDrum"). The longword at 0x20 holds the sample's period in 24.8 fixed point. The words at 0x5c and 0x5e set how fast the note's volume rises and falls (code+0x1a3e4, code+0x1a396).
- FORM, 6 files: `sword.instr`, `whoosh.instr` and `magic.instr` on each disk are IFF 8SVX samples. Disk 1's have 5 octaves at 8,363 samples a second. Disk 2's are single-octave copies at about 6,250 to 6,500, a fraction of the size.
