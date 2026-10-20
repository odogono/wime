---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0da20
  - disasm:code+0x0da6c
  - disasm:code+0x0daa4
  - disasm:data+0x3e68
  - disasm:code+0x0e7c6
issue: 94
---

**The Council of Elrond is held once, at the first hour mark on the Campaign Level when the Ring-bearer's Force's Leader stands on Rivendell, (1216, 384), and Gandalf, entry 1, is at (1216, 380) or (1216, 384).**
The test is part of the hourly update (code+0x0d894), which the tick calls only on the Campaign Level, when the clock steps onto a whole hour (finding:time-daily-check-opens-the-8am-sweep, finding:ai-war-events-checked-only-on-campaign-level). It runs every hour, before the hour-8 checks. It follows the Ring-bearer's leader chain to the top (code+0x0da20), and compares that Leader's position and entry 1's position exactly (code+0x0da6c). Entry 1 starts asleep at (1216, 380), with Rivendell, (1216, 384), as his destination, so the Council is held when the Ring-bearer arrives while Gandalf is still there, asleep or awake. Entry 1's strength is not tested here.

The byte at data+0x3e68 starts at 1 and must be set; the Council clears it (code+0x0daaa), so it is held only once. The byte is inside the region the Archive saves. The test also requires the byte at data+0x4c72 to be set; it is written by the routine that turns the sprite DMA on and off (code+0x184fc), so it presumably says the pointer is shown, as it is in play on the Campaign Level.
