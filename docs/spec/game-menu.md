# In-game menu

A menu opened during play to save, load or leave the game. The original
has none: it saves and restores only through the Full Map Level's
scroll, to one Archive file (`finding:ui-archive-window`,
`finding:ui-single-save-slot`). The menu is the port's own, built on its
save slots (docs/spec/saving.md), and shares the title menu's window
(docs/spec/title-menu.md).

## Opening and closing

- Escape opens it on every Level, unless Escape has something else to
  close first: the Game Speed or information window, an order under way,
  Galadriel's Mirror, the Archive window or the magnifying glass.
- A Menu button at the top left of the page opens it too. It is hidden
  on the title screen and while the menu is open.
- It waits while a fight, an encounter talk, a meeting, the Council of
  Elrond or the ending holds the game, as the autosave does, so a save
  never catches one half done.
- While it is open the game stands still: the scene stays as it was
  when the menu opened, dimmed, and no game time passes. The view's own
  timers stand still too: a message on screen, Gandalf's letter and the
  Animation Level's figures carry on once it closes as if no time had
  passed.
- Close, or Escape on its first menu, closes it.

## The choices

- In a game from a Shuffled Setup, a line over the first menu names it,
  `Shuffled Setup <seed>`, and the window is widened to fit
  (docs/spec/shuffled-setup.md). A Classic game shows no line.
- **Save** lists New save, then the named slots newest first, each with
  its in-game date, then Back. The autosave is not offered.
  - New save asks for a name, typed in, up to 24 letters; a bar marks
    where the next one goes. Enter or Save saves it, an empty name
    becoming `Save <n>`; Escape or Back goes back.
  - A named slot asks before saving over it, its answer resting on
    Go back. The slot keeps its name.
  - Either answers with a message: saved, or not saved, with why when
    storage is full.
- **Load** lists the autosave, then the named slots newest first, then
  Back, as the title menu's Load does. Choosing a save asks first,
  resting on Go back, since the game in play is lost if not saved. A
  loaded game returns to its Level, as from the title menu
  (docs/spec/title-menu.md). A save of another version is refused with a message.
- **Settings** lists Sound, Window size, Glass shows Evil, Map and Back,
  each showing what holds now. Choosing Sound switches the music and
  effects off or on, as Q does. Choosing Window size steps it from Full
  to 75% to 50% and back: the game fills that share of the browser
  window, centred, at the largest whole scale that fits. Glass shows
  Evil is the port's own: the magnifying glass, or a double tap, on
  Forces with no Good Leader in reach goes down showing the first Evil
  Force's figures where it stood, walking in from the right and off the
  left edge as passers do, instead of the empty spot
  (`finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot`).
  Nobody is watched, as at the empty spot, so time stands still,
  and no new scene follows them. Map switches the map Levels between
  Classic and the Atlas map at once (docs/spec/atlas-map.md). All four
  are kept in the browser's storage, so they hold after a reload; sound
  starts on, the window full, Glass shows Evil off and the map Classic.
- **Debug views**, offered in Settings only in a dev build or with
  `?debug` in the URL, are the port's own overlays on the Campaign
  Level, each switched on and off by itself and kept with the settings.
  None is on at first.
  - **Terrain** tints each tile by its terrain percentage, red when
    slow through yellow to green at 100%, and hatches 0% tiles, with a
    legend below the map.
  - **Paths** draws a dotted arrow from each Force to its destination,
    then thinner dotted legs through the Default Orders stops still
    queued, coloured by Side.
  - **Encounter areas** outlines each Encounter figure's area with its
    name, greyed once it can no longer be met or before its day.
  - **Force labels** writes each Force's Leader's roster index and
    name, and its strength, above it.
  - **Pointer info** shows the tile, terrain percentage and Place under
    the pointer.
- **Return to title** autosaves the game, then goes back to the title
  menu, with Title playing. If the autosave fails, the game stays in
  play and a message says so.

## Keys and the mouse

As the title menu: the arrows move the selection, wrapping; Enter or
space chooses, except while typing a name, where space is a letter;
Escape goes back to the first menu. The pointer over a row selects it,
and a click chooses it. Q switches sound off or on
(`finding:sound-q-toggles-sound`), except while typing a name.

## The Archive window

The Archive window keeps the original's look, messages and single slot,
the named slot Archive (`finding:ui-archive-window`). That slot is
listed by the menu's Load and Save like any other.
