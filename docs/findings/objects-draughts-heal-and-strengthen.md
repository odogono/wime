---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06e92
  - disasm:code+0x06f8a
  - disasm:code+0x0700c
  - resource:BScene.res#CSTR 34
  - resource:BScene.res#CSTR 35
  - observed:objects-use-blue-potion
  - observed:objects-use-black-flask
  - observed:objects-use-glowing-vial
issue: 102
---

**A blue potion heals the user to full health, a black flask adds one to fighting strength, and a glowing vial adds one to maximum health and then heals to it. Each is used up.**

- **Blue potion** (code+0x06e92): if health is below maximum, "<name> feels much better."; otherwise "<name> feels no effect.". Either way health is set to maximum (roster byte 25 into word 26).
- **Black flask** (code+0x06f8a): fighting strength, roster byte 23, goes up by one, with "<name> feels an odd strength flow into his limbs!" (BScene CSTR 34).
- **Glowing vial** (code+0x0700c): maximum health goes up by one and health is set to it, with "<name> has a growing feeling of exceptional health!" (CSTR 35).

All three are used up (finding:objects-use-table), even a blue potion that had no effect. There is no cap: each flask or vial raises the value again.

In play, Frodo at health 3 of 7 drank a blue potion: "FRODO feels much better.", health 7, potion gone. A black flask took his fighting strength from 4 to 5, and a glowing vial at health 2 took his maximum from 7 to 8 and his health to 8.
