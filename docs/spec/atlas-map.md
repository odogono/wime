# Atlas map

The port's own way of drawing the two map Levels: one vector map of
Middle Earth in the manner of Tolkien's maps, ink on parchment, that
zooms continuously from the Full Map Level into the Campaign Level
(ADR-0006). The original draws the Campaign Level from tiles
(`finding:ui-campaign-level-display`) and the Full Map Level as one
picture (`finding:graphics-full-map-art-is-imag-2`); that drawing stays
as Classic. Nothing in the game's rules changes: the Atlas map is how the
same world is shown and pointed at.

## The setting

- The in-game menu's Settings shows the setting, **Map: Classic** or
  **Map: Atlas**, and choosing it switches between them at once
  (docs/spec/game-menu.md). Classic is the default.
- The setting is kept with the other settings in the browser, not in
  saved games; a game loaded or started keeps it. The Debug views are
  drawn on Classic only.
- Switching keeps the map on the same spot.
- Where the Atlas map cannot be made, for want of WebGL2 or of its
  exported geography, the map stays Classic.
- The Animation Level, the title screen and every window are the same in
  both.

## One map, two bands

- The Atlas map fills the window. The icon columns, the date line and
  every window are drawn over it as in Classic, at the same size.
- How far it is zoomed decides the Level. Zoomed out past the band's
  boundary it is the Full Map Level: game time stops, the eye, scroll,
  magnifying glass and hourglass are offered, and Galadriel's Mirror and
  the Archive window open over it (docs/spec/full-map.md). Zoomed in past
  it, it is the Campaign Level, where Orders are given.
- Zoomed all the way out, the whole map fits the window; all the way in
  is four times the Campaign Level's scale. The Campaign Level's scale
  shows as much map across the window as the original's screen does.
- Crossing the boundary takes a little more zoom than coming back, so
  zooming across it does not flicker between Levels.

## Moving about

- The wheel zooms about the pointer, on either Level. Dragging the map
  pans it, on either Level. The map does not scroll at the window's
  edges.
- U, or the map icon, goes up: the map glides out to the Full Map Level.
- The Full Map Level's magnifying glass goes down: the map glides in to
  the Campaign Level's scale over the spot clicked.
- Going up from the Animation Level, starting or loading a game, and a
  fight on the Campaign Level centre the map as Classic centres its view.

## Forces

Forces are drawn by how far the map is zoomed, each tier with a little
hysteresis so it does not flicker:

- **Emblem:** the Force's own emblem (docs/spec/atlas-emblems.md, and
  ADR-0007): a banner bearing the silhouette of its Leader's figure for a Character, a
  shield for a Unit, its field in the Force's side colour. It grows with
  the map from 24 to 64 CSS pixels tall; zoomed out past where it would
  be smaller than 24 pixels, the Force is drawn Compact. Active Forces
  flash.
- **Compact:** the Emblem's outline alone, 16 CSS pixels tall, in the
  side colour with an ink rim: a banner for a Character, a shield for a
  Unit.
- **Dot:** a small dot in the side colour.
- **Aggregate:** dots that would overlap merge into one, with how many it
  stands for beside it.

The Ring-bearer's Force, and a Force being given an Order, are drawn one
tier more detailed than the zoom alone gives. The Ring-bearer's Emblem and
Compact marker carry the Ring mark. An Emblem standing on
a Place stands beside its picture.

Pointing at a Force picks it by the picture drawn for it: hovering names
it, clicking opens its window, and picking a Force for an Order takes
the Force whose picture is under the pointer. Everywhere else the pointer
names the Place or ground under it, as in Classic.

## The geography

The map's geography is traced from the original's tiles by
`bun run build-geography` and corrected by hand in `geography/patches/`
(ADR-0006). It draws:

- the ground: woods, hills, mountains, marsh, lakes and the sea, traced
  from the tiles' pixels;
- rivers as tapering ink lines, roads as dashed lines, and bridges and
  fords where roads cross water;
- mountain ranges as peaks along each range's spine, darker in the
  ranges about Mordor;
- a faint wash of relief under the ink, lit from the north west, so
  ranges and hills read with some height while plains, marsh and water
  stay clean parchment. The height is made up for the picture; the
  original has none, and the game's rules never read it;
- each Place as an ink picture of its kind, with its name, and the
  regions' names in wide lettering.

Finer detail, lesser Places and roads give way as the map zooms out;
names never overlap each other or a Force, and where two Places' pictures
would overlap, the greater one is drawn.
