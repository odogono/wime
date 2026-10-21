# Title menu

The menu over the title screen once the boot sequence is over
(docs/spec/boot-sequence.md). The original has none: its boot sequence
runs straight into a new game, and a game is restored only from the
Full Map Level's scroll (`finding:ui-archive-window`). The menu is the
port's own, built on its save slots (docs/spec/saving.md).

## The screen

- When the boot sequence ends, the title screen and its logo return,
  in the title palette, with the menu in a window framed as the game's
  windows are (`finding:ui-window-frame-tiles`), on the cream parchment
  of the Ring verse. Title plays on under it, and Q switches sound off
  or on (`finding:sound-q-toggles-sound`).
- A key that skips the boot sequence brings the menu up at once.
- Nothing is saved while the menu is up.

## The choices

- **Resume** loads the most recent save this build can load, the
  autosave or a named slot, by when it was saved. An Archive imported
  from before named slots has no saved time and counts as the oldest.
  Resume is shown only when there is such a save.
- **New Game** starts the game from its opening, with Gandalf's letter.
  When there is a save to resume it asks first, its answer resting on
  Go back: named saves are kept, but the autosave is written over when
  it next runs.
- **Load** lists the autosave, then the named slots newest first, each
  with its in-game date, and ends with Back. A save of another version
  is lettered in grey, colour 22, and, chosen, answers with a message instead of
  loading. The list shows six rows at a time, scrolling with the
  selection.
- A loaded game, by Resume or Load, opens on the Animation Level with
  the Ring-bearer, as a new game does, without Gandalf's letter. Game
  Speed and the camera are not saved (docs/spec/saving.md). A load that
  fails answers with a message, and any key or click goes back to the
  menu.

## Keys and the mouse

- The up and down arrows move the selection, wrapping; Enter or space
  chooses; Escape goes back to the first menu.
- The pointer over a row selects it, and a click chooses it.
- The selected row is lettered in dark red, colour 18 of the Animation
  Level's palette, whose window the menu borrows.
