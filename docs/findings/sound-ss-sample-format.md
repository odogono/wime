---
kind: fact
topic: data-formats
confidence: confirmed
sources:
  - disasm:code+0x1a2d4
  - disasm:code+0x1a342
  - disasm:code+0x1a36c
  - tool:tools/extract-sound.ts#parseSampledSound
issue: 130
---

**A `.ss` file holds one recording of a sound for each octave it covers, each twice as long as the one below, after a 0x3e-byte header giving the length, the loop point and the range of octaves.**
Word 0 is a base length L and word 2 the loop start in the same units; when the two are equal the sound does not loop. Bytes 4 and 5 are the lowest and highest octave stored. From byte 0x3e come the octaves in order: octave k is L × 2^k signed 8-bit samples. To play a note the driver takes octave 10 − (note ÷ 12) and drops the note if that is outside the stored range (code+0x1a2d4). It finds that octave's samples at 0x3e + L × (2^k − 2^lowest) and plays them at the period 0xd5c8 × ratio ÷ 2^15, the ratio being the note's semitone in the driver's table (code+0x1a342). A looping sound repeats from L_loop × 2^k to the end; otherwise the voice goes on to silence (code+0x1a36c).

The game has four: `piano.ss` (L 160, looping from 144) and `trumpet.ss` (L 90, from 89) and `snaredrum.ss` (L 78, no loop), and `bassdrum.ss` (L 13, no loop) on Disk 2, each covering octaves 3 to 7. `piano.ss` is 0x3e + 160 × (2^8 − 2^3) = 39,742 bytes, padded to 39,746.
