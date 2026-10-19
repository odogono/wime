---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ed54
  - disasm:code+0x0e420
issue: 10
---

**Arrival is tested only when a step lands exactly on the destination at a tile origin; the entry then turns resting (state 3) and takes the next stop off its Default Orders route, which clears the destination when the route is empty.**
The test at code+0x0ed54 compares the position with the destination on both axes after a step that ended tile-aligned, so a destination that is not itself tile-aligned can never be arrived at. On arrival the code sets state 3 (code+0x0ef26, unless the entry is a Nazgûl arriving back at Bree's tile, a special case) and calls nextRouteStop (code+0x0e420): the first Place on the route row becomes the new destination and the row shifts left, or both destination words are cleared when the row was empty. A Force with a following stop therefore pauses as if resting — regaining stamina and setting off again under the morning-window rule of finding:movement-stamina-and-rest — before travelling on. Followers never take a movement step at all: the tick skips any entry with a leader byte set (code+0x0e886), which is why only the Leader's stamina and speed matter (finding:movement-mixed-force-at-leader-pace).
