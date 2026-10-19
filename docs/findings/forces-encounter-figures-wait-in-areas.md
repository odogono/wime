---
kind: fact
topic: forces
confidence: confirmed
sources:
  - disasm:code+0x0f04e
  - disasm:code+0x0f128
  - disasm:code+0x0f180
  - disasm:code+0x0f196
issue: 5
---

**Roster entries 152 to 195 never move. Each waits in a rectangle of the map, and a passing Force meets it with a set percentage chance once a set day has come.**
For these entries the position and destination fields hold the rectangle's top-left and bottom-right corners (code+0x0f128). Byte 32 is the first day the figure can be met (code+0x0f180). Byte 29 is the chance, out of 100 (out of 50 when the mode byte at data+0x5555 is 2), that a Force inside the rectangle meets it on a given check (code+0x0f196). Small figures (strength 99 or less) are only met by Forces led by entries 1 to 12, the Fellowship; large ones are only met by other Forces (code+0x0f0fc). At the start every first day is 0. The advisors' rectangles are a single tile: Círdan at the Grey Havens, Tom Bombadil at his house, Bilbo at Rivendell, Galadriel in Lórien, Treebeard near Derndingle, all with a chance of 100 except Bilbo. The anonymous figures and creatures cover wide areas: "a Ranger", "a hobbit", "an elf", "a wanderer", "a traveler" and "an old man" share most of Eriador, with a chance of 5.
