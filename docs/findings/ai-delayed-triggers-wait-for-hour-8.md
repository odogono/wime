---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e656
  - disasm:code+0x0e694
  - observed:war-events-rohan-muster
  - observed:war-events-day-169
issue: 57
---

**A delayed trigger, one of bits 4 to 7 of byte 30, fires only during hour 8, quarter-hours 32 to 35, and only once at least as many days as its low four bits have passed since its event.**
The test subtracts the event's recorded day from the low byte of the day, as an unsigned byte, and fails if the result is below the delay. It then also requires the hour to be 8 (code+0x0e656, code+0x0e694). An event set at the 8 a.m. check is therefore seen by its 0-day entries in the same quarter-hour. An event set at any other time, such as by a tripwire at noon, wakes its 0-day entries only at the next 8 a.m. Hour 8 has four sweeps, but an entry is triggered at the first one that passes, since triggering clears byte 30.

In play, with event 5 recorded on day 8, the 8 a.m. sweep of day 10 woke Théodred, Erkenbrand and Dernhelm (0 days) and Elfhelm (2 days). Day 11 woke Grimbold (3 days), and Dunhere (4 days) was still waiting. Setting event 5 at the Isen Ford at 12:30 on day 10 woke the 0-day musters only at 8 a.m. on day 11. Event 7 on day 169 woke the 0-day armies of Mordor, Rhûn and Harad and Sauron at 8 a.m. on day 169, and the 1-day ones at 8 a.m. on day 170.
