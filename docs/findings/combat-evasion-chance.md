---
kind: fact
topic: combat
confidence: confirmed
sources:
  - disasm:code+0x0f382
  - disasm:code+0x0f41c
  - disasm:code+0x0f43e
  - disasm:code+0x0f46c
  - disasm:code+0x0f482
  - disasm:code+0x0f4ae
  - disasm:code+0x0f4b8
  - disasm:code+0x0f4dc
  - disasm:code+0x0f50a
issue: 45
---

**A Force led by a Character may slip past the enemy without a fight. The chance out of 100 is the average of its members' roster byte 29, plus 20 for each member wearing an Elven cloak.**
Before a fight starts, the game walks entries 1 to 78 (code+0x0f382). For each awake member of the Good Force it adds byte 29 to a sum, plus 20 if bit 8 of the objects word, the Elven cloak, is set (code+0x0f41c). If any member is a Unit more than 99 strong, the divisor becomes 99 (code+0x0f43e), which all but rules out evasion for an army. If random(100) is below the average, there is no fight (code+0x0f482). On the Campaign Level the message is "<Leader> evades <enemy>." (code+0x0f50a); elsewhere it passes silently.

Byte 29 is 75 for both Gandalfs and Legolas, 65 for Dernhelm, and 60 for Aragorn, Boromir and Gimli. It is 50 for a band of Rangers, 30 for the Hobbits and 210 for Gollum. It is 0 for everyone else. So the four Hobbits on their own avoid 30 meetings in 100, and 50 if they all wear Elven cloaks.

There is no escape in these cases:

- the Good Leader is a Unit (code+0x0f4ae);
- the mover stands at the Ford of Bruinen (1200, 400) or the Morannon (1744, 1008) (code+0x0f4b8);
- the enemy is Shelob, entry 151, or a Balrog, entries 183 to 187 (code+0x0f4dc).

A Force with a Unit of more than 99 is not met at all by an Encounter whose starting strength is below 99 (code+0x0f46c).
