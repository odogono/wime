# Animation Level

How the Animation Level looks and runs. Facts cite their Findings
(ADR-0004), recovered from the Reference Build for #80. The reference
captures are in `docs/re/animation-level-reference.md`. Encounters,
talks and fights shown here are in `docs/spec/encounters.md`.

## Going down and up

- The game opens on the Animation Level, watching Frodo with Sam and
  Pippin. (finding:ui-game-starts-on-animation-level)
- The game runs the Animation Level, then the Campaign Level, and back.
  The Animation Level ends when the map icon is pressed, when a fight is
  to be fought on the Campaign Level, or by itself once every figure has
  walked off the right edge while the watched Character lives.
  (finding:ui-animation-level-figures-walk-off)
- `provisional`: whether time runs on the Animation Level, and what
  going down does to the watched Character's Force, are not traced. The
  sim keeps ticking while the view shows the Animation Level, and a
  fight with a Unit on the Good side, a meeting other than a watched
  advisor talk, or the game's end brings the Campaign Level up. A
  Character fight involving the watched Character and advisor talks
  stay here (`docs/spec/encounters.md`).
- The Campaign Level's magnifying glass goes down a Level (manual,
  pdf-p15). `provisional`: how the original picks whom to watch is not
  traced; the view watches the Force under the glass.

## The screen

- The scene fills 320 by 200 lo-res pixels.
  (finding:graphics-full-screen-art-is-320-by-200)
- Three icons stand in a column at the top right: the eye at (300, 10),
  the map at (300, 25) and the provisions sack at (300, 42), each
  centred on its point. The map goes up to the Campaign Level.
  (finding:ui-animation-level-icons)
- `provisional`: the eye and the sack do nothing yet. The sack's Put
  Down, Take and Use belong to milestone 7.
  (finding:objects-handled-on-animation-level)
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
  (finding:graphics-figure-animation-scripts)
- `provisional`: the 4-plane sets are drawn in colours 16 to 31; the
  per-Character recolouring is not traced, so all Characters of a set
  look alike. (finding:graphics-four-plane-figures-use-upper-colours)
