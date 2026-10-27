---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x07f8e
  - disasm:code+0x07fb6
  - disasm:code+0x080a6
  - disasm:code+0x0e740
  - observed:game-speed-window
issue: 164
---

**The hourglass opens a message box headed "Rate of Time Passage" with a framed button for each speed, Very Hasty, Hasty and Normal; the current speed's button is red and is the box's default. The clock holds while the box is up, and unanswered it presses its default.**
The hourglass first closes the open box (code+0x05b46), then opens one at (184, 5), 90 by 68, headed "Rate of Time Passage" in colour 8 (code+0x07f8e). The current speed is read back from the clock limit: Very Hasty at 1 or less, Hasty up to 100, Normal above (code+0x07fb6). Each button is drawn framed at x 26, at y 22, 37 and 52, in colour 10 for the current speed and 5 for the others, so the current one is red and the rest black; standing in one column, all take Very Hasty's width (finding:ui-stacked-buttons-share-a-width). The box is shown with the current speed's button as its default (code+0x080a6). While a box's default is set the clock doesn't step (code+0x0e740), so time holds until a button is pressed or the box times out (finding:ui-message-box-timeouts-by-level), which presses the default and leaves the speed as it was. There is no pause button: P pauses (finding:ui-key-bindings).
