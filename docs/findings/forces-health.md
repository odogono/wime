---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x06e9c
  - disasm:data+0x1de8
issue: 5
---

**Each roster entry has a maximum health (byte 25) and a current health (bytes 26 and 27); healing sets the current health back to the maximum, with the message "… feels much better."**
The healing code (code+0x06e9c) compares the two and copies the maximum over the current value. At the start the two are equal for every entry. The maximum ranges from 1 for most Units to 9 for Elrond, the second Gandalf, Glorfindel, Galadriel, Sauron and the Ents; Frodo has 7 and the other Hobbits 5. An entry with no health left cannot be woken (code+0x0e6b6).
