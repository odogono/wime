# Objects Reference runs

The `observed:objects-…` sources in the Findings are these Reference runs, made in FS-UAE 3.2 on the Reference Build (issue #102). Each drives the game's own object handler from the debugger, then reads the result back from memory and the screen.

## Setting up

1. Boot as in [the combat reference](combat-reference.md) and press space through the title and the Ring verse to the Animation Level at Hobbiton. The runs below happened to be made on the Campaign Level on day 0; the handler does not test the Level. The data hunk was at 0x390E8 and the code hunk at 0x1D0C8; roster entry i is at 0x3AED0 + 38 × i. Write 1 to `data+0x422f` (0x3D317) to skip the copy-protection question; this is test scaffolding only.
2. Give the Character the object by writing its objects word, roster bytes 16 and 17 (Frodo, entry 7: 0x3AFEA).
3. Put a breakpoint on the object handler, `code+0x06b5c` (`f 23c24`), continue, and click anywhere in the game: every click passes through it.
4. At the break, write the chosen Character to `data+0x5559` (0x3E641), the object's button, 0x99 + its bit, to `data+0x5552` (0x3E63A), and the action to `data+0x5556` (0x3E63E): 0xbf Put Down, 0xc0 Take, 0xc1 Use. For a Token or for Take, also write the watched Character to `data+0x08cc` (0x399B4), since it is 0 on the Campaign Level, and its position, since the Force moves between steps. Toggle the breakpoint off and continue.
5. Capture the window while the message shows (it closes after about 4 seconds), then enter the debugger and dump the roster entries, the placement table (`data+0x3db0`, 0x3CE98) and the event mask (`data+0x3e69`, 0x3CF51).

This skips the provisions window, so the lists themselves (finding:objects-provisions-lists) rest on the code alone. The window texts are string literals in the code, quoted in that Finding.

## Reference runs

All use Frodo, entry 7, as both chosen and watched Character.

| Reference run                  | Set-up                                                          | Observed                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objects-use-palantir`         | Day 0, mask 0x05. Objects 0x0091 (Ring, Elven blade, Palantír). | "Looking deep into the crystal, FRODO sees a vision:" and BScene CSTR 37. Mask 0x85, event 7 day 0. Objects still 0x0091.                               |
| `objects-use-palantir-again`   | Straight after.                                                 | The same opening, then "South of Mount Gram, a band of Orcs being pursued by Rangers cast aside their spoils." Mask still 0x85.                         |
| `objects-use-blue-potion`      | Objects 0x0291, health 3 of 7.                                  | "FRODO feels much better." Health 7, objects 0x0091.                                                                                                    |
| `objects-use-black-flask`      | Objects 0x0491.                                                 | "FRODO feels an odd strength flow into his limbs!" Fighting strength 4 → 5, objects 0x0091.                                                             |
| `objects-use-glowing-vial`     | Objects 0x0891, health 2 of 7.                                  | "FRODO has a growing feeling of exceptional health!" Maximum health 8, health 8, objects 0x0091.                                                        |
| `objects-use-rope`             | Objects 0x2091.                                                 | "There is no need to use the rope here." Objects still 0x2091.                                                                                          |
| `objects-token-away`           | Objects 0x0093, Frodo far from Erebor.                          | "Use the ring at Erebor to secure Dain's help." Objects still 0x0093.                                                                                   |
| `objects-token-dain`           | As above, Frodo written onto Dáin's position (1744, 224).       | "DAIN accepts your gift and swears support to your cause." Dáin (17) allegiance 1 → 99, trigger 0x40 → 0. Objects 0x0091. Dáin's dwarves (18) stayed 1. |
| `objects-token-denethor`       | Objects 0x4091, Frodo on Denethor (1616, 1184).                 | "Gazing upon the sceptre, DENETHOR spoke. …" Denethor (32) allegiance 1 → 99, trigger 0x08 → 0. Objects still 0x4091.                                   |
| `objects-token-denethor-again` | Straight after.                                                 | "The Sceptre was the chief mark of royalty in Numenor." Nothing changed.                                                                                |
| `objects-token-thranduil`      | Objects 0x8091, Frodo on Thranduil (1696, 240).                 | "Holding the Silver Orb, THRANDUIL spoke. …" Thranduil (22) and the elves of entry 62 allegiance 99, trigger 0. Objects 0x0091.                         |
| `objects-token-theoden`        | Objects 0x1091, Frodo on Théoden (1248, 992).                   | "THEODEN's hand trembles as he holds the black feathered shaft. …" Théoden (26) allegiance 99, trigger 0. Objects 0x0091.                               |
| `objects-put-down`             | Objects 0x0091, Frodo at (768, 512); Put Down the Elven blade.  | No message. Slot 25 `63 00 0000 0000` → `04 00 0300 0200`. Objects 0x0081.                                                                              |
| `objects-take`                 | Straight after, Take the Elven blade at (768, 512).             | "FRODO goes to pick up an Elven blade." Slot 25 → `04 00 0000 0200`. Objects 0x0091.                                                                    |

The Palantír's roll is random, so `objects-use-palantir` is one sample of the 69-in-100 branch.

Keep the dumps and screenshots in a gitignored directory such as `build/fs-uae/`; they are taken from the original and are never committed.
