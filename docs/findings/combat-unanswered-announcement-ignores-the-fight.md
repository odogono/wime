---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0f7ac
  - disasm:code+0x06304
  - disasm:code+0x06318
  - disasm:code+0x0632c
  - disasm:code+0x0d00c
  - disasm:code+0x0cfb6
  - disasm:code+0x083b4
  - disasm:code+0x083d0
  - observed:combat-calembel-ignored
  - observed:combat-eomer-dies-ignored
issue: 45
---

**If the player does not answer a fight's announcement, "Ignore it" is pressed for them after 720 frames, 14.4 seconds, on the Campaign Level, or 1,020 frames on the Animation Level. Game time stands still while it waits.**
The announcement records "Ignore it" as the window's default button and sets a deadline (code+0x06304, code+0x06318, code+0x0632c). The Campaign Level loop presses the default once the deadline has passed (code+0x0d00c). While the default is "Ignore it", the loop does not run the tick, so no Force moves and the clock doesn't advance (code+0x0cfb6). "Go there" sets the fight going for the player to watch (code+0x083b4), and "Ignore it" leaves it to be settled at once (code+0x083d0; finding:combat-ignored-fight-resolved-at-once).

In play, an untouched announcement stayed up for about 14 seconds with the clock stopped, then the fight was settled as an ignored fight.
