# Title menu

The menu over the title screen once the boot sequence is over
(docs/spec/boot-sequence.md). The original has none: its boot sequence
runs straight into a new game, and a game is restored only from the
Full Map Level's scroll (`finding:ui-archive-window`). The menu is the
port's own, built on its save slots (docs/spec/saving.md).

## The screen

- When the boot sequence ends, the title screen and its logo return,
  in the title palette, with the menu centred on it in a window framed as the game's
  windows are (`finding:ui-window-frame-tiles`), on the cream parchment
  of the Ring verse. The title screen is dimmed behind it, half
  covered in black, so the window stands out. Title plays on under it, and Q switches sound off
  or on (`finding:sound-q-toggles-sound`).
- A key that skips the boot sequence brings the menu up at once.
- Nothing is saved while the menu is up.
- After 60 seconds with no input at the menu's first page, an idle Demo
  starts (docs/spec/demo-mode.md).

## The choices

- **Resume** loads the most recent save this build can load, the
  autosave or a named slot, by when it was saved. An Archive imported
  from before named slots has no saved time and counts as the oldest.
  Resume is shown only when there is such a save.
- **New Game** starts the game from its opening, with Gandalf's letter.
  When there is a save to resume it asks first, its answer resting on
  Go back: named saves are kept, but the autosave is written over when
  it next runs. It then offers **Classic Setup**, **Shuffled Setup**,
  **Movement** and **Back**: the Classic Setup is the original's start,
  and a Shuffled Setup a fresh one (docs/spec/shuffled-setup.md).
  Choosing either starts the game. Movement shows the Movement rule the
  game will be played under, **Crossing movement** at first, and
  choosing it switches between that and **Classic movement**
  (docs/spec/crossing-movement.md). When the waterways Crossing
  movement routes by cannot be loaded, Movement is lettered in grey and
  fixed at Classic movement, and a line over the page says `Crossing
movement is unavailable.` Back returns to the first menu.
- **Demo** starts a chosen Demo at once, a recorded campaign playing
  itself from a New Game, without asking: it touches no save
  (docs/spec/demo-mode.md).
- **Load** lists the autosave, then the named slots newest first, each
  with its in-game date, and ends with Back. When a save listed is from
  a Shuffled Setup, a line over the list names the selected save's
  Setup, `Shuffled Setup <seed>`, and is blank for a Classic save.
  Likewise, when a save listed is played under Crossing movement, a
  line names the selected save's rule, `Crossing movement`, and is
  blank for Classic movement; with both, the Setup's line comes first. A
  save of another version
  is lettered in grey, colour 22, and, chosen, answers with a message instead of
  loading. The list shows six rows at a time, scrolling with the
  selection.
- A loaded game, by Resume or Load, returns to the Level it was saved
  on, without Gandalf's letter: the Animation Level watching the same
  Character, or else the Campaign Level, centred on the Ring-bearer's
  Force. A game saved on the Full Map Level opens on the Campaign
  Level. If the watched Character can no longer be shown, the Campaign
  Level opens instead. Game Speed and the camera are not saved
  (docs/spec/saving.md). A load that
  fails answers with a message, and any key or click goes back to the
  menu.

## Keys and the mouse

- The up and down arrows move the selection, wrapping; Enter or space
  chooses; Escape goes back to the first menu.
- The pointer over a row selects it, and a click chooses it.
- The selected row is lettered in dark red, colour 18 of the Animation
  Level's palette, whose window the menu borrows.
