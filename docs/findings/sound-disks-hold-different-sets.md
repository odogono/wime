---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:data+0x43ce
  - disasm:data+0x472a
  - tool:tools/extract-sound.ts#loadSoundFiles
issue: 130
---

**Each disk carries the scores and instruments it plays, and several pieces come in two arrangements, a plain one and a ".B" one, both named in the game's tables.**
Disk 1 holds the title, the victory and defeat pieces and `towar.moria.smus`, with their instruments and samples. Disk 2 holds the themes named for Characters and Places, and its own copies of the instruments they share. The data hunk lists the score files with the volume they come from: "A:" for Disk 1 from data+0x472a, "B:" for Disk 2 from data+0x43ce, 0x2b bytes apart. It names both arrangements of `Title`, `UltVict`, `ShortDefeat` and `LongMajorEvil`. A ".B" arrangement differs in its tempo and its notes, and often in its instruments: `title.b.smus` plays Tsub1 and Psub1 where `title.smus` plays Trumpet2 and Piano. Which arrangement plays when has not been traced.

Not every reference can be met from one disk. `A:ShortVictory.smus` is named, but `shortvictory.smus` is only on Disk 2. Disk 1's `midbassdrum.instr` names `BassDrum.ss`, which is only on Disk 2. `gandalf.smus` and `longmajorevil.b.smus` on Disk 2 use "zofterStriHum", whose `.instr` is only on Disk 1.
