---
kind: fact
topic: movement
confidence: confirmed
sources:
  - disasm:code+0x0ed98
  - disasm:code+0x0edb2
  - disasm:code+0x0edc4
  - disasm:code+0x0eedc
issue: 205
---

**When a Leader among roster entries 1 to 78 arrives at a destination that is a Place, a box announces that it has reached the Place, except at the Grey Havens, the Barrow Downs, Rivendell and Lórien (Places 9, 13, 23 and 33), where nothing is shown.**
On arrival (finding:movement-arrival-pops-next-route-stop) moveEntry first checks the moving entry: only entries below 79, the free peoples and Gollum, go on (code+0x0ed98), so the Nazgûl and the Evil Units arrive silently. It then looks up the Place at the destination with placeAt (code+0x0edb2) and skips the box when there is none or when it is Place 13, 23, 9 or 33 (code+0x0edc4, tested in that order). Otherwise it opens a one-line box and fills it from the entry's name, " has " or, for a strength above 1, " have ", "reached ", the Place's name from the Places table and a full stop, and shows it (code+0x0eedc). No mode is tested, so the box appears on either level and for any Force, watched or not.

No other code tests these four Place numbers, so the code gives no reason for leaving them out. Each is where the story stops the hobbits to meet someone: Círdan waits on the Grey Havens' tile, Bilbo and the Council of Elrond at Rivendell and Galadriel in Lórien (finding:forces-encounter-figures-wait-in-areas), and the wight's area covers the Barrow Downs. The scan for Encounters runs in the same step, straight after the arrival (code+0x0f028), and a box raised while another is open waits for it (finding:ui-message-box-opening-waits-for-the-open-box), so skipping the arrival box there lets the meeting show at once. That purpose is an inference. The exclusion is by Place alone: a Force arriving at one of the four is never announced, whether or not anyone meets it. Tom Bombadil's House, Place 12, which holds Tom Bombadil, is announced.
