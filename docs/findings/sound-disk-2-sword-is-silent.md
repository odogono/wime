---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x1a5c6
  - disasm:code+0x1a70e
  - disasm:data+0x49af
  - resource:Disk.2#sword.instr
issue: 133
---

**The game's Sword effect never sounds: it is loaded from Disk 2, whose sword is a single octave that cannot play the notes the effect asks for, so half of the blows on the Animation Level are silent.**
The effect instruments come from the table entries "B:Whoosh", "B:Magic" and "B:Sword", all on Disk 2 (data+0x4959 to data+0x49af; finding:sound-score-and-effect-table). Disk 2's copies are one-octave 8SVX samples (finding:sound-instrument-formats). Loading one, the IFF technique halves its one-shot length, repeat length and samples per cycle until one of the lengths is odd, the cycle count reaches 1 or the octaves would pass 8, and keeps the number of halvings as a shift (code+0x1a5c6). Playing a note, it takes the octave as 10 − note ÷ 12 − shift and drops the note unless that is from 0 up to the number of octaves stored (code+0x1a70e).

Whoosh's one-shot length is 1,878 and Magic's 7,306, a shift of 1, so they play notes 0x6c to 0x77, which takes in the 0x6c to 0x6f they are asked for (finding:sound-effect-notes). Sword's is 3,212, a shift of 2, so it plays only notes 0x60 to 0x6b; it is asked for 0x5c to 0x5f, and every one is dropped. A blow picks Whoosh or Sword at random (finding:sound-fight-effects), so half the blows make no sound. Disk 1's sword has five octaves and plays them all, but the game never loads it.
