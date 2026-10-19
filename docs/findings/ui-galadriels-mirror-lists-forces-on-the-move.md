---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x07dc4
  - disasm:code+0x04dde
  - disasm:code+0x04528
  - strings:0x909d
  - manual:pdf-p9
  - observed:full-map-at-start
issue: 28
---

**Galadriel's Mirror, the eye on the Full Map Level, opens a window headed "In the still surface of the pool, you see forces moving..." with two columns: every moving Good Leader and its followers, each with where it is going, on the left, and every moving Evil Leader, by name only, on the right.**
The eye (code+0x07dc4) builds its list with the routine that also finds who is near a point (code+0x04dde), called with the point (0, 0), which means the whole map. In that mode an entry is listed only if it is awake, leads its own Force, and has a destination (bytes 12 to 15 not zero), so Forces standing still are left out. Good entries are 1 to 77, each followed by the Characters and Units that follow it; Evil entries are 79 to 151, and Evil Units with the same name are merged into one line with their strengths added. Allegiance is not tested, so a moving Good Leader not yet mobilised is listed too. The window grows by 9 pixels for each row of the longer column.

Each Good row is written by code+0x04528: the name, with "is" for a Character or the head count and "are" for a Unit, then one of "following <Leader>.", "going to <Place>." when the destination is a Place, "heading <direction>." otherwise, "at <Place>.", "resting." or, for a destroyed Unit, "All of the <Units> are dead." Evil rows give only the name. At the start of the game the window shows "FRODO is going to GREEN HILLS.", "SAM is following FRODO." and "PIPPIN is following FRODO." on the left and the nine Nazgûl on the right. Clicking anywhere closes it. On the Campaign Level the eye gives the status of the selected Force instead ("Peering through the orb you discern...", strings:0x9014), and on the Animation Level of the selected figure ("Through the mist swirling within the glass you perceive...", strings:0x8f82).
