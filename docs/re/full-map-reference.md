# Full Map Reference run

`observed:full-map-at-start` in the Findings is this Reference run, played in FS-UAE 3.2 on the Reference Build (issue #28).

1. Boot the WHDLoad install from `artifacts/amiga/WarInMiddleEarth_v1.0_0968.lha` on an A500+ with Kickstart 2.04, 1 MB chip and 4 MB fast memory.
2. Click through the Melbourne House and title screens. The game opens on the Animation Level at Hobbiton with Gandalf's letter.
3. Press U twice to reach the Full Map Level.
4. Capture the screen twice about 0.3 seconds apart to catch both blink phases, press S for Galadriel's Mirror and capture it, click to close it, then press A for the Archive window and capture that.

Keep the captures in a gitignored directory such as `build/fs-uae/`; they are extracted from the original and are never committed. What they show:

- The Full Map: red dots for the Nazgûl around the Shire and for the Evil Forces in Mordor, green dots across Rohan, Gondor, Mirkwood and the north, and Frodo's dot at Hobbiton flipping between cyan and invisible.
- The Mirror: "FRODO is going to GREEN HILLS.", "SAM is following FRODO." and "PIPPIN is following FRODO." on the left, the nine Nazgûl on the right.
- The Archive window at the top right: "Would you like to...", "Restore an old game", "Save current game".

To recolour a Full Map resource as the game does, decode it with `decodeImagResource` in `tools/extract-graphics.ts` and the 16 RGB4 words at `data+0x4ac8` of `extracted_asm/data.bin`.
