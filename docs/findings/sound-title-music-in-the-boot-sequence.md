---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:code+0x02224
  - disasm:code+0x02232
  - disasm:code+0x02830
  - disasm:code+0x02842
issue: 145
---

**Title starts with the Melbourne House screen and plays under the whole boot sequence. If no key was kept, the game waits after loading for Title to end before the first Animation Level begins; if one was, it stops Title at once.**
The start-up routine asks for entry 26, Title.B, or Title with memory to spare (finding:sound-full-arrangements-need-memory, finding:sound-score-and-effect-table), and plays it (code+0x02224) just before setting the frame count to 0, so the boot sequence's timetable (finding:ui-boot-sequence-screens) is counted from the music's start. Once the Animation Level's resources and first scene are loaded, with the Ring verse on screen if it was shown, the loop at code+0x02830 waits while the playing piece's word at offset 0x0a is not 0, unless a key was kept by the boot sequence's waits (finding:ui-boot-sequence-key-skips). The loop reads no keys itself. Then the piece is freed (code+0x02842) and the Animation Level loop starts. So a key before the Credits ends Title with the boot sequence, and otherwise Title plays to its end, over the Ring verse if it outlasts the Credits. `provisional`: that the word at 0x0a is cleared when the piece ends.
