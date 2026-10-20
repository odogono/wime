---
kind: fact
topic: sound
confidence: confirmed
sources:
  - disasm:data+0x43ce
  - disasm:code+0x17888
  - disasm:code+0x1792a
  - disasm:code+0x020a8
issue: 131
---

**The game names every piece and sound effect in one table of 36 entries, 0x2b bytes apart from data+0x43ce, each a path starting with the disk it is on, "A:" for Disk 1 or "B:" for Disk 2. Asking for a piece is writing its entry number to data+0x4ff2.**
The score loader (code+0x17888) takes an entry number and loads `<path>.smus`. It first copies the entry's disk letter into a path the instrument loader uses, so the score's instruments come from the same disk (finding:sound-disks-hold-different-sets). The instrument loader (code+0x1792a) does the same for single instruments. The entries are:

| Entries | Path                                                                                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–15    | B:Aragorn, Beware, Boromir, Dwarfs, Fortress, Frodo, Gandalf, Hob.Riven, LongMajorEvil.B, MagicMeditate, MinasTirith.B, Rohanians, ShortDefeat.B, LongMajorEvil.B, ShortVictory, Threatening, each `.smus` |
| 17      | B:ToWar.Moria.smus                                                                                                                                                                                         |
| 20–31   | A:LongMajorEvil.B, LongMajorEvil, ShortDefeat.B, ShortDefeat, ShortVictory, ShortVictory, Title.B, Title, ToWar.Moria, ToWar.Moria, UltVict.B, UltVict, each `.smus`                                       |
| 32–35   | the instruments A:ReverbBells, B:Whoosh, B:Magic and B:Sword                                                                                                                                               |

Entries 16, 18 and 19 are empty. Code that wants music writes an entry number to data+0x4ff2, 0x63 meaning none, and the loader (code+0x020a8) loads it, frees the last piece and sets the request back to 0x63. With sound off it loads nothing. The plain and ".B" pairs from entry 20 are chosen between by finding:sound-full-arrangements-need-memory.
