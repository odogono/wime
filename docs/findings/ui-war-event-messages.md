---
kind: fact
topic: ui
confidence: confirmed
sources:
  - disasm:code+0x0e102
  - disasm:code+0x0e1b0
  - disasm:code+0x05be2
  - disasm:code+0x0633a
  - disasm:code+0x0e740
  - observed:war-events-day-149
  - observed:war-events-day-169
issue: 57
---

**The two dated War Events are announced in a one-line message box at the top left of the Campaign Level, "Saruman's army is on the march!" and "The Dark Lord's armies march forth!". The box has no buttons, closes by itself after 200 frames, about 4 seconds, and the clock keeps running while it shows.**
Both texts are string literals in the code, not resources. They are shown through the message box routine with no buttons: with the arguments 10, 5, 144 and 24 for Saruman (code+0x0e102) and 10, 5, 160 and 24 for the Dark Lord (code+0x0e1b0), presumably position and size. A box without buttons sets no default answer and expires 200 vblanks after it opens, or 60 when the clock limit at data+0x08c2 is 0 (code+0x0633a). The clock stops only for a box with buttons (code+0x0e740), so time and movement go on underneath it. Opening another box first waits for the open one to expire (code+0x05be2), so messages queue in the order they are raised. One daily check raises at most one of the two: event 4 is tested before event 7 and needs day 149 or bit 7 already set, so it cannot be set in the same pass as event 7. No other War Event, event 1, 3, 5 or 6 or a tripwire, is announced. The Palantír shows its own vision (finding:ai-war-events-set-once).

In play both boxes appeared at the top left over the map, with the date line reading "9 a.m." (finding:time-daily-check-opens-the-8am-sweep), and stayed up while the clock ran on.
