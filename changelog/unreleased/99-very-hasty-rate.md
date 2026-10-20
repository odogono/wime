---
type: fix
scope: view
section: fixed
---

**Very Hasty runs at the same pace on every display.** It advances one
quarter-hour every 20 ms, the original's 50 Hz frame, instead of once
per drawn frame, so a 144 Hz screen no longer runs it faster (#99).
