---
kind: fact
topic: places
confidence: confirmed
sources:
  - disasm:code+0x0f722
  - disasm:data+0x3e7a
issue: 5
---

**Seventeen named Places have bit 0 of their grid byte set, and a battle at one of them is announced as "<Place> is being attacked by …".**
The battle code checks the Place at the battle's position, and only if this bit is set does it show the message (code+0x0f722). The Places are Rivendell, Thranduil's Palace, Erebor, Dale, the Iron Hills, Lórien, the Hornburg, Edoras, Minas Tirith, Dol Amroth, Lossarnach, Ethring, Erech, Anfalas, Pinnath Gelin, Calembel and Pelargir. These include the five Strongholds (finding:places-three-strongholds-lost-loses). The same bit changes something on the Animation Level at code+0x0b06e, which has not been traced.
