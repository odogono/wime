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
- **Return to title** autosaves the game, then goes back to the title
  menu, with Title playing. If the autosave fails, the game stays in
  play and a message says so.
- **Map** shows how the map is drawn, Map: Classic or Map: Atlas, and
  choosing it switches between them at once; the menu stays open. The
  setting is kept in the browser, not in saved games
  (docs/spec/atlas-map.md).

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
