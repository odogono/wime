---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x184f0
  - disasm:code+0x1859c
  - disasm:code+0x02294
  - disasm:code+0x02346
  - disasm:code+0x02708
  - observed:boot-sequence-timing
issue: 145
---

**The boot sequence's screens fade: the screen routine code+0x184f0 called with 0 fades the screen to black, one RGB4 step every 2 frames, and called with 1 fades it in from black over 32 steps of 2 frames, about 1.3 seconds.**
With 0 (code+0x184f0) the routine takes 1 from every non-zero red, green and blue of the copper list's colour registers, waits two frames and repeats until every colour is 0, at most 15 steps, then turns the display off. With 1 (code+0x1859c) it turns the display on, keeps the target palette, and 32 times loads the current colours, waits two frames and moves each component one step towards the target. The boot sequence fades out before clearing the screen for the Synergistic screen and before the title screen (code+0x02294), fades each picture in once it is drawn (code+0x02346), and fades the title screen out before the Ring verse (code+0x02708). The logo and the Credits are drawn over the title screen without a fade. In FS-UAE a capture after the Credits showed the title screen dimmed to dark brown on its way to black, and each scheduled picture was ready to fade in about 30 frames after its time (finding:ui-boot-sequence-screens).
