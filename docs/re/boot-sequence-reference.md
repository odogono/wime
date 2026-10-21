# Boot sequence reference (issue #145)

How `observed:boot-sequence-timing` was captured. Boot as in [`fs-uae.md`](fs-uae.md), FS-UAE 3.2.35, with the code hunk at 0x1D0C8 and the data hunk at 0x390E8. Enter the debugger as soon as FS-UAE starts, set breakpoints, and at each stop dump the frame count, `S /tmp/x 3E0D6 4`: the word at data+0x4fee and, in the fourth byte, the memory flag at data+0x4ff1. Write each dump to a new file and read it a moment later, since the debugger catches up slowly.

| Breakpoint | Code         | Marks                                        |
| ---------- | ------------ | -------------------------------------------- |
| 0x1F40E    | code+0x02346 | a picture drawn, before its fade-in          |
| 0x1F4C0    | code+0x023f8 | the logo drawn, without the Credits          |
| 0x1F5E0    | code+0x02518 | the logo drawn, before the Credits           |
| 0x1F5F2    | code+0x0252a | the Credits begin                            |
| 0x1F7A4    | code+0x026dc | the Credits end                              |
| 0x1F870    | code+0x027a8 | the Ring verse drawn                         |
| 0x1F90A    | code+0x02842 | the wait for Title over                      |
| 0x28690    | code+0x0b5c8 | Gandalf's letter opened; deadline at 0x3E11A |

Don't set a breakpoint at code+0x02830: the wait loop branches back to it, so every `g` stops there again.

| Scenario                      | Setup                                                   | Observed (frames)                                                                                                             |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `boot-low-memory`             | 1 MB and then 2 MB chip memory; no keys                 | flag 0; pictures 1, 273, 572; logo 676; verse 2810; count restarts while loading; wait 21 to 3219; letter 3575, deadline 3775 |
| `boot-credits`                | `f 1F242`, then `W 3E0D9 1` at the stop to set the flag | pictures 1, 273, 572; logo 789; Credits 1000 to 3457; verse 3603                                                              |
| `boot-key-on-melbourne-house` | space (key code 49) just after the first picture        | Animation Level loaded within 5 s; no Ring verse                                                                              |
| `boot-keys-during-verse`      | five spaces, 2 s apart, from 5 s after the verse        | the wait for Title still lasted about 62 s                                                                                    |

Under WHDLoad the memory flag stays 0 whatever the chip memory, so the Credits show only when the flag is set by hand. Captures taken without stopping, 18 to 75 s after setting it, showed the bare title screen, the logo and the first Credits rising, the full columns, and the title screen fading out.

`message-box-letter-timeout` (issue #168): booted with spaces pressed through the pictures, then `S` dumps of data+0x4fee to data+0x5034 (0x3E0D6) while Gandalf's letter was up. The letter's deadline was frame 640; at frame 1298 its width word data+0x502e was still 0x100, and at frame 2284 it was 0.
