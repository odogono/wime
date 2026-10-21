---
kind: fact
topic: time
confidence: confirmed
sources:
  - disasm:code+0x0b29a
  - disasm:code+0x0b304
  - disasm:code+0x0ec26
  - disasm:code+0x0e768
  - disasm:code+0x0e748
  - disasm:code+0x0b2ac
  - observed:animation-level-frodo-from-the-glass
issue: 160
---

**Game time runs on the Animation Level, but in step with the watched Character: the roster sweep stops on it whenever it is due to move a pixel, and waits there until its figures have walked off the screen. So while the watched Character travels, every Force and the clock advance only as fast as its figures cross the scene.**
The Animation Level loop (code+0x0b29a) calls the tick (finding:time-clock-advances-after-each-roster-sweep) once a frame with the watched entry as its argument (code+0x0b304). The tick still moves entries 1 to 151 in turn, not the watched one only. But when the entry it reaches is the watched Character and its fraction of a pixel would carry it a whole pixel, the tick steps the sweep back one entry, moves nothing and returns 2 (code+0x0ec26). The loop then stops calling the tick while the watched Character is moving (state 1), so no Force moves, no Encounter or meeting is found and the clock cannot step. When the figures have walked off the right edge, the loop calls the tick once with argument 0, which moves the watched Character and builds the next scene (finding:movement-watched-character-advances-as-its-figures-walk-off), and the sweep runs on until the watched Character is next due a pixel.

At the end of a sweep on the Animation Level, the clock steps at once, without the Game Speed wait, if the watched Character is not resting and has a destination; otherwise it waits for the frame counter to reach 256, about five seconds, whatever the Game Speed (code+0x0e768; finding:time-game-speed-clock-limits). A watched Character that is resting or asleep never holds the sweep, so then the world runs one entry a frame and a quarter-hour about every 256 frames. With no watched Character (entry 0) the loop never calls the tick, and time stands still (code+0x0b2ac). On any Level the clock also waits while a message box is open or a Campaign Level command such as the magnifying glass is pending (code+0x0e748). The hourly update and the War Events run only on the Campaign Level (finding:ai-war-events-checked-only-on-campaign-level).

In FS-UAE, after going down with the magnifying glass onto Frodo moving towards (656, 400), the sweep sat at entry 6, the one before Frodo (entry 7), while his figures crossed the screen, about 25 seconds each time. Each time they walked off, Frodo moved one pixel, from (640, 384) to (641, 385), (642, 386) and so on, and the Nazgûl nearby moved in step. The clock went from quarter-hour 85 to 90 over five crossings, where the Campaign Level had stepped about one quarter-hour every two seconds.
