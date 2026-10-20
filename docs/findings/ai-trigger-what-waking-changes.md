---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e6a8
  - disasm:code+0x0e6e6
  - disasm:code+0x0e420
  - disasm:code+0x129dc
  - observed:war-events-event-3-midday
  - observed:war-events-day-169
issue: 57
---

**When an entry's trigger is met, the game wakes it only if it is asleep, mobilises it only if its allegiance is 1, takes its first Default Orders destination only if its route has one, and then clears byte 30. If the entry has no strength or no health left, nothing happens, and its trigger is tested again every sweep.**
The trigger (code+0x0e6a8) first returns unless strength (byte 6) and health (byte 26) are both above 0, and leaves byte 30 untouched. Otherwise:

- **State:** 0 becomes 1. A moving, resting or skipped entry keeps its state.
- **Allegiance:** 1 becomes 99. Evil 0, 99 and the other values (2, 3, 4, 40, 70; finding:mobilisation-allegiance-byte) are kept.
- **Destination:** if the route row's first Place is not 0, it becomes the destination and the row shifts along (code+0x0e6e6, finding:ai-default-orders-are-place-queues). If the row is empty, as for row 0, the old destination is kept.
- **Byte 30** becomes 0, so a trigger fires once.

Nothing else changes: not the position, facing, Leader or event mask. A follower can be triggered. It is woken and given a destination, but it does not move while it has a Leader. A Character killed in a fight has its state set to 0 with its strength (code+0x129dc), so a dead entry looks asleep but can never be triggered.

In play, the awake but unmobilised Denethor, entry 32, stayed in state 1 and became allegiance 99 with no destination, since his route is row 0. Imrahil, entry 42, became 99 and set off for Linhir, the first Place of his route. The sleeping, already-mobilised Forlong, entry 45, went from state 0 to 1, kept allegiance 99 and headed for Minas Tirith. Evil Units woken by event 7 stayed allegiance 0 and took their first destinations.
