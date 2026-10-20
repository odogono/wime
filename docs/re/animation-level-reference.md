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

## Spell flash (issue #141)

`observed:animation-level-spell-flash` is a controlled figure-script run in
FS-UAE 3.2.35, using the same boot drive. Captures and memory dumps are
under `build/fs-uae/` and are not committed.

1. Enter the debugger and verify the code and data bases. This run used
   code 0x1d0c8 and data 0x390e8. Change Frodo's roster figure byte to 4
   and colour selector to 4, then re-enter the Animation Level to load
   the wizard. This is a presentation fixture, not an ordinary fight.
2. Find the wizard object through the handle list at data+0x5036 (count
   at data+0x5034). Figure records are 28 bytes: facing at +2, frame at
   +3, set at +9, last script offset at +10, deadline at +14, x/y at
   +16/+18. In this run the wizard was at 0x5a864 and the flash at
   0x5c4b6; these addresses must be found afresh after a new boot.
3. Put the wizard on frame 11, at (80, 108), unmirrored, with last script
   offset 0x24 and deadline zero. Set battle lines to 70 and 250, and
   data+0x08cd to 1 for fight delays. Run to code+0x0c644, just after
   event 0x10: the new flash is mirrored, frame 0, at (137, 126).
4. Step updates with a breakpoint after `updateFigures`, code+0x0b156.
   Setting only the flash's deadline to zero makes one script update
   run per pass. Its early frames are 0 at (137, 126), 1 at (150, 126),
   2 at (155, 126), and 3 at (159, 126); the burst is frame 4 at
   (254, 120). The port matches the launch and all 15 sampled updates
   from the next frame-0 cycle through this burst. Its following
   event 0x0e moves the flash to x 350.
5. Repeat with the wizard mirrored at (250, 108), restoring the battle
   lines before the cast. The flash is unmirrored at (249, 126), then
   frames 1, 2 and 3 at x 243, 237 and 231. The burst is at (67, 120).
   The port matches the launch and all 31 updates through this burst.

For the screenshots, hold the wizard after its casting pose by temporarily
replacing script 4 offset 0x27 with wait-zero (0x60). Hold the burst by
replacing script 18 offset 0x13 (rightward) or 0x20 (leftward) with
wait-zero, after tracing the original continuation. Let several PAL
frames run so the emulator presents the redrawn image before capturing.
Restore those bytes afterward (0x44, 0x8e and 0x8e respectively).

`spell-right-bolt.png`, `spell-right-burst.png` and
`spell-left-burst.png` show the red-and-yellow bolt and crescent burst.
They were compared visually with `build/spell-rendering.png`, made by
the port's normal `drawFigures` using the exported assets. Frame 4 faces
left in the unmirrored art and right when mirrored, as in the captures.
The deadline stepping and held poses establish placement, movement and
artwork; they do not establish wall-clock timing or which fight orders
start these scripts. The broader fight choreography remains provisional
in `docs/spec/encounters.md`.
