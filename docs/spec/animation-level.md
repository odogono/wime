# Animation Level

How the Animation Level looks and runs. Facts cite their Findings
(ADR-0004), recovered from the Reference Build for #80. The reference
captures are in `docs/re/animation-level-reference.md`. Encounters,
talks and fights shown here are in `docs/spec/encounters.md`.

## Going down and up

- The game opens on the Animation Level, watching Frodo with Sam and
  Pippin. (finding:ui-game-starts-on-animation-level)
- The game runs the Animation Level, then the Campaign Level, and back.
  The Animation Level ends when the map icon is pressed, or when a fight
  is to be fought on the Campaign Level.
- Going down changes nothing about the watched Character's Force: it
  keeps its destination, Order and followers. Each time its figures
  walk off the right edge it takes one step on the map and the scene is
  rebuilt where it now stands, the figures walking in again from the
  left; with no destination the Level goes up instead
  (finding:movement-watched-character-advances-as-its-figures-walk-off,
  finding:ui-animation-level-figures-walk-off).
- Time is held to the watched Character's walk: when the sweep reaches
  it and its step would move it a pixel, the sweep stops there, moving
  nothing, until its figures walk off; then that step is taken and the
  sweep runs on. Meanwhile no Force moves, no Encounter or meeting is
  found and the clock stands still. With nobody watched, time stops
  (finding:time-animation-level-holds-the-sweep-at-the-watched-character).
- Otherwise time runs at the Animation Level's own pace, whatever the
  Game Speed: a sweep every 151 frames while the watched Character
  travels, and a quarter-hour every 256 frames when it rests or has
  nowhere to go. Pause still stops it.
  `provisional`: the original moves one roster entry a frame; the port
  runs the whole sweep at once at the end of those frames.
- A fight with a Unit on the Good side, a meeting other than a watched
  advisor talk, or the game's end brings the Campaign Level up. A
  Character fight involving the watched Character and advisor talks
  stay here (`docs/spec/encounters.md`).
- The Campaign Level's magnifying glass goes down a Level (manual,
  pdf-p15). It watches the first Good row of the Forces near the spot,
  gathered as a fight's rows are: the lowest-numbered awake Good Leader
  in reach, if it is entry 1 to 78, whichever Force is nearest the
  pointer. Otherwise, with an Evil Force alone or bare ground under the
  glass, the Level shows the spot, rounded down to 16 pixels, with
  nobody watched; no figures walk, and it stays until the map icon is
  pressed
  (finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot).
  `provisional`: the original flashes the chosen row's icon four times
  first, which the port does not.

## The screen

- The scene fills 320 by 200 lo-res pixels.
  (finding:graphics-full-screen-art-is-320-by-200)
- Three icons stand in a column at the top right: the eye at (300, 10),
  the map at (300, 25) and the provisions sack at (300, 42), each
  centred on its point. The map goes up to the Campaign Level.
  (finding:ui-animation-level-icons)
- The sack opens Put Down, Take and Use; see `docs/spec/objects.md`.
  (finding:objects-handled-on-animation-level)

## Selecting and status

- A click hits the nearest figure whose current frame holds the point:
  the highest depth, and of equal depth the one added first. An icon or
  an open box takes the click before any figure behind it.
  (finding:ui-animation-level-click-takes-the-frontmost-figure)
- A figure clicked shows its entry's status line, the line Galadriel's
  Mirror gives it, in a box at (10, 5), 208 by 24, with no buttons,
  which closes after 200 frames (60 on Very Hasty). If the entry is
  one of roster entries 1 to 78 it becomes the selected Character.
  Nothing happens during a fight. The watched Character does not
  change. (finding:ui-animation-level-clicking-a-figure-selects-it)
- The selected Character is one for the whole game: a figure clicked,
  the magnifying glass's pick, or the sack's Character. A new or
  loaded game starts with none.
- The eye, or S, shows the selected Character's status in a box at
  (10, 5), 260 wide: "Through the mist swirling within the glass you
  perceive..." in colour 8, then its status line; for a Character
  "He is" and its health, of "near death" to "hale and hardy", and
  what it carries, four names to a line and at most eight; for a Unit
  "They have" and its morale, of "poor" to "excellent". A dead entry
  gets only its status line. With nobody selected it reads "Please
  select someone before requesting status." It has no buttons and
  closes as the click's box does.
  (finding:ui-animation-level-eye-shows-the-selected-status)
- `provisional`: the original's click point is the hand pointer's
  fingertip; the port's is the browser pointer's. The status line of
  an Evil or Encounter figure is assumed to read as a Good one's.

- Every colour comes from the Animation Level palette.
  (finding:graphics-animation-level-palette)
- Windows use the shared frame with AMaps.res IMAG 12.
  (finding:ui-window-frame-tiles)

## The scene

(finding:graphics-animation-level-scenes-by-tile)

- A scene is built when the Level is entered, from the tile under the
  watched Character, with the original's random numbers seeded from
  that tile, so a tile always shows the same scenery.
- The sky is a plain fill in the colour for the hour, darker in the
  south-east, with up to three clouds by day; the clouds are placed
  afresh each time. (finding:graphics-animation-level-sky-by-hour)
- The tile's scene word picks a scenery list; each group draws one
  strip, shifted for parallax by the Character's place within the tile.
  Set pieces, a river, the scenery of particular Places
  (finding:graphics-animation-level-place-scenery) and the foreground
  rows follow.
- The view's scenery never changes what the sim does.

## Figures

- The watched Force walks across from the left, its members' figures
  in a column reaching left from x -10, and the Level goes up by itself
  once they have all walked off the right edge.
  (finding:ui-animation-level-figures-walk-off)
- Each roster entry in the scene shows as many figures as the low byte
  of its strength, at most 10 (riders 3, figure 7 5), and no more than
  50 in all. Good figures stand from y 165 and Evil ones from y 166,
  two pixels lower for each further row; nearer figures are drawn
  later. (finding:ui-animation-level-figures-walk-off)
- A figure byte below 20 names the FRML figure set; 20 or more is a
  still picture with that IMAG id.
  (finding:ui-animation-level-figures-walk-off,
  finding:graphics-animation-level-figure-sets)
- A frame is placed with its hot spot on the figure's position.
  (finding:data-formats-frml-frame-lists)
- Figures are moved by their set's script: frames, steps, waits,
  random jumps, facing and events.
  (finding:graphics-spell-flash)
- Event 0x10 spawns a set-18 flash at the caster's current position:
  entry 0x0a from its right edge when unmirrored, entry 0x17 from its
  left edge when mirrored, with the launch hot spot 20 pixels below
  its top (50 for an unmirrored Balrog). The flash faces the opposite
  way to its caster, has depth 150 and uses its original colours.
  Its script moves it six pixels per frame toward the opposite battle
  line, cycling through frames 1, 2, 3 and 0; frame 4 bursts there,
  then event 0x0e moves it offscreen. Each cast removes set-18 flashes
  past x 320 and moves its own battle line as in the Finding. These
  figures belong entirely to the view, including during a fight.
  (finding:graphics-spell-flash)
- During a fight each figure's frame delay moves one step toward its
  speed on every frame, without the laggard adjustment used while the
  Force walks; a new flash starts with delay 10.
  (finding:graphics-spell-flash)
- Figures use roster byte 19 as their colour selector. A nonzero
  selector maps four source bitplanes into the five screen bitplanes;
  zero copies five planes unchanged. Source colour 0 stays clear.
  (finding:graphics-figure-colour-selectors)
