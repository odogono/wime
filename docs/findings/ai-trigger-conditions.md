---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:code+0x0e4e4
  - disasm:code+0x0e82e
  - disasm:code+0x0e6a8
  - disasm:data+0x3e69
issue: 5
---

**Byte 30 of a roster entry is its trigger: by its highest set bit, it says when the entry is woken, mobilised and set on its Default Orders. Bit 0 triggers it when the Ring-bearer comes within 9 pixels, bit 2 when Gandalf comes within 4, bits 1 and 3 as soon as their event has happened, and bits 4 to 7 at hour 8 once the number of days in the low four bits has passed since their event.**
Triggering (code+0x0e6a8) needs the entry to have strength and health left. It wakes a sleeping entry (state 0 becomes 1) and mobilises an unmobilised one (allegiance 1 becomes 99, finding:mobilisation-allegiance-byte). It also sets the first destination of its Default Orders (finding:ai-default-orders-are-place-queues) and clears byte 30. So the byte serves both the sleepers and awake entries such as Denethor, who stands at Minas Tirith but is not yet mobilised.

The main loop tests byte 30 only when its bits are also set in the event mask at data+0x3e69 (code+0x0e82e). For bits 4 to 7 the mask is tested against the high four bits only. The mask is 0x05 at the start, so only the bit 0 and bit 2 conditions are live. The day each event happened is kept at data+0x3e6a plus the bit number (finding:ai-war-events). The Ring-bearer test follows the Ring-bearer's chain of leaders and compares positions (code+0x0e4e4). The Gandalf test accepts either Gandalf entry if it is awake.

At the start:

- Elrond, Glorfindel, Aragorn, Merry, Gollum and Shelob wait for the Ring-bearer.
- Théoden, the Ents and the Huorns wait for Gandalf.
- The second Gandalf waits for event 1.
- Denethor, Imrahil, the lords of the southern fiefs and Gondor's Units wait for event 3.
- Saruman's Units and a band of Rangers near Isengard wait 0 to 10 days after event 4.
- The Rohan musters wait 0 to 4 days after event 5.
- Gandalf, Dáin, Brand, Thranduil, Celeborn, the Elves and the Iron Hills Dwarves wait 0 to 10 days after event 6.
- The armies of Mordor, Rhûn and Harad and Sauron wait 0 to 13 days after event 7.

Other code may also trigger entries directly; that has not been traced.
