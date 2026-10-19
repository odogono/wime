---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e0c0
  - disasm:code+0x0e0da
  - disasm:code+0x0e12c
  - disasm:code+0x0e148
  - disasm:code+0x0e170
  - disasm:code+0x0e190
  - disasm:code+0x07136
  - disasm:code+0x0efec
issue: 5
---

**Five war events trigger the later stages of the game (finding:ai-trigger-conditions), each recorded as a bit of the event mask with the day it happened: Saruman marches on day 149, Sauron's armies on day 169, and Rohan, Gondor and the northern Elves and Dwarves join as other events happen.**
The daily check at hour 8 sets them in this order:

- If Gandalf is asleep with no trigger left and bit 1 is clear, bits 1 and 2 are set (code+0x0e0c0). This triggers the second Gandalf, whose trigger byte is bit 1, presumably once the first has died.
- Bit 4 is set on day 149 (20 February) or once bit 7 is set, with the message "Saruman's army is on the march!" (code+0x0e0da).
- Bit 5 is set once Théoden's allegiance is above 1, that is, once Rohan is mobilised (code+0x0e12c).
- Bit 3 is set once Denethor's allegiance is above 1, or once bit 7 is set (code+0x0e148).
- Bit 6 is set once bit 7 is set (code+0x0e170).
- Bit 7 is set on day 169 (10 March), with the message "The Dark Lord's armies march forth!" (code+0x0e190).

Bit 7 can also be set sooner: by a random chance after a vision in the Palantír (code+0x07136), and in the battle code (code+0x0efec), which has not been traced. At the start the mask is 0x05 and every event day is 0.
