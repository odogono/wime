---
kind: fact
topic: data-formats
confidence: provisional
sources:
  - tool:tools/extract-sound.ts#parseInstrument
issue: 130
---

**A synthesised instrument's 502 bytes hold its name, a 128-byte waveform and the settings of the Sonix synthesiser: a second waveform, volume and pitch envelopes, a filter, portamento and vibrato.**
Only the size, the name at 0x24 and the waveform at 0x44 are confirmed (finding:sound-instrument-formats). The rest follows nuade's port of the Sonix Music Driver (finding:sound-game-carries-the-sonix-driver) and has not been traced in the game's code:

| Offset        | Field                                        |
| ------------- | -------------------------------------------- |
| 0x44          | the waveform, 128 signed bytes               |
| 0xc4          | a second, 64-byte waveform for modulation    |
| 0x1cc         | base volume                                  |
| 0x1ce         | portamento on or off                         |
| 0x1d0, 0x1d4  | how much the envelope moves volume and pitch |
| 0x1d2         | slide rate                                   |
| 0x1d6 – 0x1da | filter base, range and envelope amount       |
| 0x1dc – 0x1e0 | envelope rate, loop point and delay          |
| 0x1e2, 0x1e4  | vibrato settings                             |
| 0x1e6, 0x1ee  | four envelope targets, then four speeds      |
