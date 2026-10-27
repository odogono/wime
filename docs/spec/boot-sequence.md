# Boot sequence

What the game shows from start-up until the first Animation Level: the
Melbourne House and Synergistic screens, the title screen, the Credits,
the Ring verse and Gandalf's letter. Facts cite their Findings
(ADR-0004), recovered from the Reference Build for #145. The title
menu, save slots and autosave that #144 adds are the port's own and are
not covered here.

## The screens

(finding:ui-boot-sequence-screens)

- Every screen is 320 by 200 and uses the title palette, not the
  Animation Level's. (finding:graphics-title-screen-palette)
- Times are frames at 50 a second, counted from when Title starts.
- Before the Synergistic screen and the title screen the screen fades
  to black, one RGB4 step every 2 frames; each picture then fades in
  from black over 32 steps of 2 frames. The logo and the Credits appear
  without a fade. On the Amiga each fade-out made a picture about 30
  frames later than its time. (finding:graphics-boot-screens-fade)

  | Frame | Screen                                                        |
  | ----- | ------------------------------------------------------------- |
  | 0     | ATitle.res IMAG 70 at (92, 22) on black: Melbourne House      |
  | 240   | the screen cleared, IMAG 71 at (44, 41): Synergistic Software |
  | 540   | IMAG 72 over the whole screen: the title screen               |
  | 600   | IMAG 73, the logo, at (48, 20) over the title screen          |
  | 1000  | the Credits begin                                             |

- The original skips the Credits when it lacks memory, holding the
  logo until frame 2600 instead. The port has memory to spare, so it
  always shows the Credits.

## The Credits

(finding:ui-boot-credits-scroll)

- AText.res CSTR 59, the roles, at x 0 and CSTR 60, the names, at x 94
  of a 160-pixel column whose left edge is at screen x 84. Each text is
  drawn in colour 1 with a one-pixel outline in colour 2.
- The column starts with its top at y 200 and rises one pixel a step
  for 600 steps over the title screen. The code waits at least 3
  frames a step, but on an A500 a step took about 4 frames and the
  Credits about 49 seconds; the port matches the A500's 49 seconds. From
  the 16th step the logo rises with it from y 20.

## The Ring verse

(finding:ui-ring-verse-window)

- The title screen fades to black and a window without title or buttons
  opens at (40, 20), 240 by 120, using the shared window frame
  (finding:ui-window-frame-tiles).
- AText.res CSTR 57 is drawn at (20, 20) and CSTR 58 at (20, 70), in
  colour 5 of the title palette, keeping their leading spaces.
- It stays on screen while the Animation Level loads and, unless a key
  was pressed before the Credits, until Title ends, about 64 seconds
  more on an A500. Keys and clicks do not move past it.
  (finding:sound-title-music-in-the-boot-sequence)

## Moving on

(finding:ui-boot-sequence-key-skips)

- Screens give way on the timetable above; clicks do nothing.
- A key before frame 600 skips the logo, the Credits and the Ring verse
  and stops Title, going straight to the Animation Level.
- A key from frame 600 to the start of the Credits skips the Credits
  and stops Title once the Animation Level is loaded; the Ring verse
  still shows.
- A key during the Credits ends them; the Ring verse shows and the
  game still waits for Title to end.
- Q also switches sound off or on, as everywhere.
  (finding:sound-q-toggles-sound)

## Title

(finding:sound-title-music-in-the-boot-sequence)

- Title starts with the Melbourne House screen and plays on under the
  whole sequence.
- Unless a key skipped part of the sequence, the first Animation Level
  waits for Title to end. A key before the Credits stops it as the
  Animation Level begins.

## Gandalf's letter

(finding:ui-gandalfs-letter)

- On the first Animation Level of a new game, a window without buttons
  opens at (10, 5), shown at x 8, 256 by 112, with BScene.res CSTR 56
  in colour 5 of the Animation Level palette.
- It closes by itself as any box without buttons on the Animation
  Level does, 1,500 frames after it opens, or 1,360 at the clock limit
  0, unless a later box replaces it after 200 frames (60)
  (finding:ui-gandalfs-letter, finding:ui-message-box-timeouts-by-level),
  while Frodo, Sam and Pippin walk on beneath it.
- It is shown once per game, and is not saved: a restored game does not
  show it, as in the original, where restoring the Archive never
  brings it back. (finding:ui-gandalfs-letter-not-shown-after-restoring)

## In the port

The port's own departures, since a browser page is not a floppy boot.

- Browsers play sound only after the player's first input, so the page
  opens on the Melbourne House screen, fading in, and the timetable and
  Title start with the first key or click. That input skips nothing.
- After that a click does what a key does, and a key or click on the
  Ring verse ends the sequence, so every screen can be skipped; in the
  original clicks do nothing and nothing moves past the verse.
- The Animation Level loads at once, so the Ring verse is held for at
  least 150 frames, 3 seconds, where the original showed it while
  loading. Without sound, or with Q switching it off, nothing else
  holds it.
- When the sequence ends the title menu opens over the title screen
  (docs/spec/title-menu.md). Starting a new game from it writes no
  save; the autosave first runs when it is next due
  (docs/spec/saving.md).
- The Ring verse's window is cream parchment with a dark edge, as the
  capture showed, drawn like a message box on the Animation Level
  (finding:ui-window-frame-tiles). The disassembly suggests the colour 15
  fill of a box off the Animation Level, a dull brown in the title
  palette; the port follows the capture.
