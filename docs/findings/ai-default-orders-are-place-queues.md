---
kind: fact
topic: ai
confidence: confirmed
sources:
  - disasm:data+0x3b00
  - disasm:code+0x0e420
  - disasm:code+0x0e6e6
  - tool:tools/extract-starting-state.ts#readStartingState
issue: 5
---

**Default Orders are queues of up to eight Places. Byte 36 of a roster entry picks its row of an 86-row route table at data+0x3b00, and each time the entry needs a new destination it takes the first Place off the queue.**
Each row holds up to eight Place numbers, ended by a 0 when shorter. Taking the next destination copies the first Place's position into the entry's destination and shifts the rest of the row along (code+0x0e420). When the row is empty the destination is cleared. Waking an entry takes its first destination this way (code+0x0e6e6). Rows 1 to 85 belong to entries, and 77 of them hold a queue at the start. At the start, for example, Frodo is heading for Green Hills with Woodhall, Buckland, Bombadil's House, Bree and Rivendell queued. Aragorn's queue runs from Midgewater Marsh and Weathertop to the Last Bridge, the Ford of Bruinen and Rivendell. Each Nazgûl has its own tour of the Shire, Bree and Weathertop ending at the Ford of Bruinen. The Evil armies' queues lead to Minas Tirith, Edoras, the Hornburg, Lórien and Thranduil's Palace. One Wainrider army's queue runs from Dale through Rivendell to Hobbiton.
