# Animation Level reference

The `observed:animation-level-opening` scenario in the Findings is this run, made in FS-UAE 3.2.35 on the Reference Build (issue #80).

## Setting up

Boot as in [the combat reference](combat-reference.md): the WHDLoad install on an A500+ with Kickstart 2.04, 1 MB chip and 4 MB fast memory. Mouse clicks did not move past the Ring verse; a key press (space) did. Capture the window with `screencapture`, as the other references do, and keep the captures in a gitignored directory such as `build/fs-uae/`.

## Scenario

| Scenario                  | Steps                                                         | Observed                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animation-level-opening` | Boot, press space at the title, the Ring verse and the letter | The title screen and the Ring verse, then the Animation Level: a stone bridge over a stream below Hobbiton's houses, a blue sky with clouds, and the eye, map and sack icons in a column at the top right. Gandalf's letter shows over it in a framed window while Frodo, Sam and Pippin walk right across the bridge. After the letter closes they walk off the right edge and the bare scene stays. The picture fills 320 by 200 of the screen. |

## Reading the scene code

The scene builder, figure scripts and icons are traced in the Findings; the main addresses are in [`labels.md`](labels.md). Parts of `extracted_asm/code.asm` decode misaligned, for example code+0x09e02, which shows as `ori.b` at 0x09e04; disassemble those ranges again from the function's start.

Not yet traced:

- The per-Place special scenery switch on bits 10–15 of the scene word (code+0x00d3c, switch at code+0x01f0e).
- Figure script events other than 1, 2, 0xf, 0x10 and 0x11, and jump condition 0x18.
- Where the battle lines (data+0x5568, data+0x556a) and the start lines (data+0x5564, data+0x5566) are set: code+0x0a316 and code+0x0a936.
- What the eye (button 0xf0) and sack (0xf9) icons open.

## Encounters (issue #81)

The Encounter Findings rest on the code alone. A first attempt to play `encounter-bombadil` (Frodo, entry 7, put at (736, 416) moving east onto Tom Bombadil's tile at (752, 416), with the clock limit at 16 frames) was cut short when the 3rd Nazgûl attacked Frodo first ("FRODO is attacked by the 3rd NAZGUL.", with "Go there" and "Ignore it"). To play it, first move the Nazgûl (entries 79 to 87) away or put them to sleep.

Still to capture: an advisor's talk window answered, declined and timed out; a talk on the Animation Level; an anonymous figure passing by; an Evil Encounter fought on the Animation Level.

Figure colours are now traced in finding:graphics-figure-colour-selectors (#119).
