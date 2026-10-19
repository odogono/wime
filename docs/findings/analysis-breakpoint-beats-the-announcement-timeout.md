---
kind: lesson
topic: analysis
confidence: observed
sources:
  - disasm:code+0x0f812
  - observed:combat-faramir-go-there
issue: 45
---

**To answer a fight's announcement in FS-UAE, set a debugger breakpoint just after the window is drawn, at code+0x0f812, rather than watching screenshots. The announcement presses "Ignore it" by itself after 14.4 seconds, too quickly to catch by polling captures.**
With the breakpoint the emulator stops as the window appears, which leaves time to save memory and line up the pointer before clicking "Go there". The game's own timer counts emulated frames, so the pause costs nothing. Two other traps cost time in this analysis. Clicks and key presses only reach FS-UAE when posted as CGEvents, not through cliclick. And an Amiga pointer resting on the map's edge keeps the Campaign Level scrolling, which skips the tick, so the clock never moves. A set-up also has to move the mover onto a tile origin: placing two Forces on the same spot doesn't start a fight (finding:combat-fight-starts-when-evil-meets-non-evil).
