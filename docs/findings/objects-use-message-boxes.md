---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06e70
  - disasm:code+0x06e92
  - disasm:code+0x06fac
  - disasm:code+0x0705c
  - disasm:code+0x070c4
  - disasm:code+0x07180
  - disasm:code+0x07200
  - disasm:code+0x072a8
  - disasm:code+0x07358
  - disasm:code+0x07400
issue: 105
---

**Choosing an object to use closes the list at once, plays no animation, and shows its result in a box at (10, 5) without buttons, with the text at (10, 8) in colour 5; the box's width and depth depend on the message.**
Use (code+0x06e70) does not queue a figure command or mark an order under way. Every box closes by itself after 200 frames (finding:ui-war-event-messages).

| Use (finding)                                      | Width × depth       | Text                                                |
| -------------------------------------------------- | ------------------- | --------------------------------------------------- |
| blue potion (objects-draughts-heal-and-strengthen) | 128 × 24            | name + " feels much better." or " feels no effect." |
| black flask                                        | 192 × 24            | name + BScene CSTR 34                               |
| glowing vial                                       | 208 × 24            | name + CSTR 35                                      |
| Palantír (objects-palantir-vision-or-tip)          | 256 × 64            | see below                                           |
| rope (objects-rope-has-no-use)                     | 160 × 24            | CSTR 36                                             |
| Dwarven Ring at Dáin / elsewhere                   | 256 × 24 / 192 × 24 | CSTR 38 / 39 (mobilisation-token-shown-to-ruler)    |
| Red Arrow at Théoden / elsewhere                   | 256 × 49 / 192 × 24 | CSTR 40 / 41                                        |
| sceptre at Denethor / elsewhere                    | 256 × 56 / 208 × 24 | CSTR 42 / 43                                        |
| silver orb at Thranduil / elsewhere                | 256 × 48 / 224 × 24 | CSTR 44 / 45                                        |

The draughts draw the name and the rest as one line (finding:ui-message-box-text-colour); the rope and Token texts are passed to the box routine. The Palantír's box (code+0x070c4) draws "Looking deep into the crystal, <name> sees a vision:" at (8, 8) in colour 5, and the vision, CSTR 37, at (8, 18) in colour 5, or else an advisor's tip (code+0x0b7e0).
