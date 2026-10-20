---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x00090
  - disasm:data+0x08ac
  - disasm:data+0x08b8
  - disasm:code+0x0010e
issue: 80
---

**An Animation Level scene's sky is a plain fill whose colour follows the hour, with clouds added by day.**
The sky colour is data+0x08ac[quarter-hour ÷ 8], a 12-entry table `04 04 0a 0b 0c 0c 0c 0c 0b 0a 04 04`: dark purple (0x426) at night, through blues to the brightest (0x2ae) around midday (code+0x00090). In the south-east of the map, and during a fight on the Animation Level (fightState 2), it comes from data+0x08b8[quarter-hour ÷ 16] instead, `10 04 05 05 04 10`: near-black and dull greys, a darker sky. From quarter-hour 16 to 79 (4 a.m. to 8 p.m.), three tries at one in four each draw one of AScene.res IMAG 1283 to 1285, a cloud, at a random place (code+0x0010e).
