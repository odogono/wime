---
kind: fact
topic: objects
confidence: confirmed
sources:
  - disasm:code+0x06c22
  - disasm:code+0x06c84
  - disasm:code+0x06cf8
  - disasm:code+0x0c1f4
  - disasm:code+0x0c36c
  - disasm:code+0x0c784
  - disasm:data+0x095e
issue: 162
---

**Taking an object sends the chosen Character's figure to script entry 0xd4: it walks to the object's picture, stoops for one frame, the picture vanishes, it walks back to where it stood, turns back to its old facing, and the order ends; the "goes to pick up" message is shown at once, as it sets off.**
Before starting the script the Take handler records the figure's x and facing (data+0x556c and data+0x5563, code+0x06c22) and puts the object picture's x in the first battle line, data+0x5568 (code+0x06c84). The figure is then called at entry 0xd4 of its script (code+0x06cf8, through code+0x0a5ce, which calls the entry and starts the figure at once), and the message box opens straight after (finding:objects-take-message). For every walking set the entry reads `a1 a0, ff, 81, a1 a0, 84, a4 68, bf`:

1. Call 0xa0, the walk to the first battle line: if the figure faces away from the line it plays the turn at 0x68 (the bending frames of finding:objects-put-down-is-a-stoop-in-place, turn round, the same frames in reverse), then repeats the six-frame walk cycle at 0x0a until it reaches the line, stopping on the step that reaches it. The cycle steps 5 px a frame for most sets, 3 for the hobbit (FRML 0, at speed 7), 4 for the dwarf and 6 for the rider; the hobbit's script walks one more cycle past the line.
2. Show one frame, the stoop (the byte ff above, at 0xd6): 16 for the hobbit, man and dwarf (FRML 0, 2, 3, 14), 15 for the elf, 0 for the wizard and rider, 18 for the small orc, 8 for the troll, 3 for the balrog, 6 for the rest.
3. Event 1 (code+0x0c1f4) moves the picture to y 200, off the bottom of the scene, and copies the figure's old x back into the first battle line.
4. Call 0xa0 again, the walk back to that x.
5. Event 4 (code+0x0c36c) ends the order and wakes the party (finding:ui-provisions-window-holds-the-party).
6. If the figure's facing now differs from the one recorded (condition 4, code+0x0c784), play the turn at 0x68; then return to the script the figure was running.

The objects word and the slot change before the walk starts (finding:objects-take-from-the-ground), so the time taken is the walk there and back at the figure's pace, about 10 frames a step. The picture stays in the scene's list of six until the next scene.
