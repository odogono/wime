---
kind: fact
topic: graphics
confidence: confirmed
sources:
  - disasm:code+0x0c52c
  - disasm:code+0x037d8
  - disasm:code+0x0beb4
  - disasm:code+0x0c038
  - disasm:data+0x095e
  - resource:BScene.res#FRML 18
  - observed:animation-level-spell-flash
issue: 141
supersedes: graphics-figure-animation-scripts
---

**Figure-script event 0x10 shoots a set-18 flash toward the opposite battle line: frames 1, 2, 3 and 0 in flight, then frame 4 before it disappears.** This extends finding:sound-fight-effects and corrects the event descriptions in finding:graphics-figure-animation-scripts. The values 0x0a and 0x17 passed to `newFigure` are script entry offsets, not image frames. Set 18 has only five image frames; its first four look like small bolts and its fifth is the burst.

At code+0x0c52c, a cast first deletes set-18 figures whose top-left x is greater than 320. It creates a new set-18 figure with depth 150, colour selector 0 and initial image frame 0. The new figure's hot spot is subtracted from the launch point, as for other figures (code+0x038a0); frame 0's hot spot is (1, 2).

| Caster facing | Flash script entry | Flash facing | Launch hot spot                                                                    | Battle line changed                              |
| ------------- | ------------------ | ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Unmirrored    | 0x0a               | Mirrored     | (caster x + current frame width, caster y + 20), adding another 30 to y for set 12 | Left line becomes caster x + current frame width |
| Mirrored      | 0x17               | Unmirrored   | (caster x, caster y + 20)                                                          | Right line becomes caster x − 30                 |

Here caster x and y are the current frame's top left, including script movement before the event; the width is from the frame displayed when interpretation began (code+0x0beb4). Thus the launch point is below the top of the caster's picture, rather than above it. Both branches play Magic (finding:sound-fight-effects).

The set-18 script at data+0x1b16 starts either entry by setting speed 1 and clamping movement to the opposite battle line. It repeatedly calls entry 0: show frame 0, then move six pixels toward the opponent before each of frames 1, 2 and 3, and move six more before returning. When the flash reaches the opposite line, it clears the clamp, sets speed 15 and shows frame 4. Its next update runs event 0x0e, moving x to 350, and keeps showing frame 4 offscreen until a later cast removes it. During a fight the current delay moves toward the speed on each frame, without the walking party's laggard adjustment (code+0x0c038); a new flash starts with delay 10.

Only the scripts for sets 4 (wizard), 8 (hooded figure) and 12 (Balrog) contain event 0x10, in both attack routines at entry 0x1a and 0x2a. Their roster users are Gandalf (both entries), Radagast, the old man and Saruman for set 4; the nine Nazgûl, Gothmog, Sauron, the wight and the Dead Men for set 8; and the five Balrogs for set 12. This identifies figures capable of the effect, not a claim that every one enters a fight in ordinary play.

The other interpreter details from the superseded Finding still hold: each set has a 252-byte script at data+0x095e; the top three bits select the operation and the low five select its argument. Frame changes preserve the hot spot, measured from the right when mirrored. The operations are frame (0x00), step backward (0x20), step forward (0x40), wait (0x60), event (0x80), jump/call/return (0xa0), speed (0xc0) and facing (0xe0). A wait of zero stops, other waits last n × 25 plus random(n × 25) vertical blanks, and calls keep up to seven return addresses. Events 1 and 2 handle objects, 0x0f switches to set 16, 0x10 shoots the set-18 flash, and 0x11 creates set 19. Jump conditions test facing, battle lines, random thresholds or a set-specific frame.

The controlled `animation-level-spell-flash` reference run captures a small red-and-yellow bolt and the taller crescent-shaped burst, mirrored for a rightward cast. The port matches the original's launch and the sampled frame positions through each burst in both directions. See `docs/re/animation-level-reference.md` for the setup and the limits of this comparison: the debugger advances updates and holds the capture poses, so this does not measure real-time pacing or natural fight choreography.
