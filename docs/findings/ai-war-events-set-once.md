---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e0c0
  - disasm:code+0x0e0da
  - disasm:code+0x0e12c
  - disasm:code+0x0e148
  - disasm:code+0x0e170
  - disasm:code+0x0e190
  - disasm:code+0x07136
  - disasm:code+0x0ef60
  - disasm:code+0x0efd0
  - disasm:data+0x3e69
  - observed:war-events-day-149
  - observed:war-events-day-169
  - observed:war-events-early-7
  - observed:war-events-theoden-denethor
  - observed:war-events-gandalf-killed
issue: 57
supersedes: ai-war-events
---

**Each War Event is a bit of the event mask at data+0x3e69 that, once set, is never cleared. Every rule that sets one first checks that it is clear, and records the low byte of the day in data+0x3e6a plus the bit number, except event 1, whose day is never recorded.**
The mask is 0x05 at the start and every event day 0. Bits 0 and 2 are never cleared, which keeps the Ring-bearer and Gandalf trigger conditions live all game (finding:ai-trigger-conditions). Byte data+0x3e6a is the Ring-bearer, so "event day 0" is not a real slot.

The daily check (finding:time-daily-check-opens-the-8am-sweep) applies these rules in this order:

1. **Event 1.** It is set (with bit 2, already set) when the first Gandalf, entry 1, is asleep, his trigger byte is 0 and bit 1 is clear (code+0x0e0c0). No day, no message. See finding:ai-second-gandalf-wakes-when-the-first-sleeps.
2. **Event 4, Saruman.** It is set when the day is exactly 149 (20 February) or bit 7 is set, with "Saruman's army is on the march!" (code+0x0e0da).
3. **Event 5, Rohan.** It is set when Théoden's allegiance (entry 26, byte 28) is above 1 (code+0x0e12c). No message.
4. **Event 3, Gondor.** It is set when Denethor's allegiance (entry 32) is above 1, or bit 7 is set (code+0x0e148). No message.
5. **Event 6, the Elves and Dwarves.** It is set when bit 7 is set (code+0x0e170). No message.
6. **Event 7, Sauron.** It is set when the day is exactly 169 (10 March), with "The Dark Lord's armies march forth!" (code+0x0e190).

Because event 7 comes last, events 3, 4 and 6 follow it only at the next day's check. In play, day 169 at 8 a.m. set event 7 alone. Day 170 at 8 a.m. set 3, 4 and 6, all recording day 170, and showed Saruman's message. Event 7 set early, at any time on day 100, likewise brought 3, 4 and 6 at 8 a.m. on day 100. A day-169 check that finds bit 7 already set does nothing and shows nothing. Making Théoden and Denethor allegiance 99 before 8 a.m. set events 5 and 3 at that check.

Outside the daily check:

- Events 3 and 5 are also set when an Evil Leader steps onto the Isen Ford (finding:mobilisation-evil-at-the-fords-of-isen).
- Event 7 is also set when a non-Evil Leader reaches the approaches to Mordor (finding:ai-good-force-near-mordor-starts-the-war), and on 69 rolls in 100 after a vision in the Palantír (code+0x07136).

Of these, only the Palantír shows anything: its vision of the dark sky and battlements, BScene CSTR 37, appears only when the roll sets the event. The movement tripwires set their bits silently (finding:mobilisation-tripwires-follow-arrival).
