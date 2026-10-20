---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e82e
  - disasm:code+0x0e868
  - observed:war-events-event-3-midday
  - observed:war-events-isen-ford-evil
issue: 57
---

**Each tick tests the current entry's trigger before deciding whether the entry moves, so an entry woken by its trigger takes its first step in the same tick. A trigger condition that changes during a sweep is seen by the later entries of that sweep and by the earlier ones only in the next.**
The tick for entry n tests byte 30 against the event mask and, if a condition may hold, calls the trigger test (code+0x0e82e). Only then does it check whether the entry moves: awake, not skipped, leading its own Force, with a destination and strength (code+0x0e868). The test runs for every entry from 1 to 151 whatever its state, including sleepers, followers, dead entries and Evil ones. Encounter figures, entries 152 to 195, are never ticked, so their trigger bytes are never read.

In play, event 3 written at 12:30 woke Denethor, Imrahil, the southern lords and Gondor's Units in that same quarter-hour. When the Hand Orcs, entry 88, set event 3 at the Isen Ford during the 12:30 sweep, Gondor's entries, all below 88, woke in the 12:45 sweep.
