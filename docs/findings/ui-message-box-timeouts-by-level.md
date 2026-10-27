---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x06318
  - disasm:code+0x0633a
  - disasm:code+0x0d00c
  - disasm:code+0x0b78a
  - disasm:code+0x0d6fa
  - observed:message-box-letter-timeout
issue: 168
---

**A message box times out by the 50 Hz vblank count, not by game time. A box with buttons is answered by its default when its deadline passes: 720 frames on the Campaign Level, 1,020 on the Animation Level. A box without buttons stays much longer than its 200-frame deadline: until 1,020 frames after it on the Campaign Level (1,220 in all) and 1,300 after it on the Animation Level (1,500 in all), 60 and 1,080 or 1,360 on Very Hasty. On the Full Map Level no box times out.**
Opening a box sets its deadline in data+0x5032 from the vblank count data+0x4fee (code+0x06318): 720 frames ahead for a box with buttons, or 1,020 when the Level, data+0x5555, is 3, the Animation Level. A box without buttons gets 200 frames, or 60 when the clock limit data+0x08c2 is 0, Very Hasty (code+0x0633a). That deadline only says when a later box may replace it (finding:ui-message-box-opening-waits-for-the-open-box).

Each Level's loop decides when the box closes. The Campaign Level loop (code+0x0d00c) closes it when there is a default button and the count is past the deadline, or when the count is more than 1,020 past the deadline. The Animation Level loop (code+0x0b78a) does the same with 1,300. The Full Map Level loop (code+0x0d6fa) has no such check, so a box there stays until it is answered or replaced. The counts go on in every case: they are frames of real time, and they do not stand still with the clock or while the player is on another Level. Closing presses the default (code+0x05b54), so a box with buttons left alone is answered as if its default were clicked.

In FS-UAE, Gandalf's letter, a box without buttons on the Animation Level (finding:ui-gandalfs-letter), had its deadline at frame 640 and was still up at frame 1298. By frame 2284 it had closed, as the 1,940 limit predicts.

Earlier Findings read the 200-frame deadline as the time a box without buttons stays up; it is only the shortest time.
