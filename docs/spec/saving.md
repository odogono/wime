# Saving

How a game is saved and restored. Facts about the original cite their
Findings (ADR-0004); the rest is the port's own design.

## The original

- The original has a single save slot: saving overwrites it, and saving
  and restoring are reached only through the Full Map Level's scroll.
  (`finding:ui-single-save-slot`, `finding:ui-archive-window`)

## Named save slots (a departure)

The port keeps several named save slots instead of the one Archive file,
on purpose (#147). The departure is in storage only: the Archive window
keeps the original's look and messages (`finding:ui-archive-window`).

- Each slot holds a game written by `serialiseSave`, its name, when it
  was saved (wall-clock time) and the in-game date (`formatClock`).
- A game from a Shuffled Setup (docs/spec/shuffled-setup.md) is saved
  with its Setup seed, beside the state rather than in it, and loads
  with it. A save without one is from the Classic Setup, as every save
  from before Shuffled Setups is, so adding it needed no
  `SAVE_VERSION` bump. A damaged Setup is refused as a damaged state
  is.
- Slots can be listed, saved into, saved over (keeping their name),
  loaded, renamed and deleted. An empty name becomes `Save <n>`. Slot
  ids are never reused.
- A save of another `SAVE_VERSION` is listed but cannot be loaded, as
  the single slot refused it before. A save whose state is damaged is
  refused too, never loaded in part. There is no migration: 0.9.0
  and 1.0.0 wrote `SAVE_VERSION` 8, and version 9 (#297) refuses their
  saves with the other-version message. Version 10 added the Movement
  rule (`docs/spec/crossing-movement.md`); a version 9 save still loads,
  as Classic movement.
- Storage that is full or unavailable is reported as a failure, never
  thrown; a failed save leaves the existing slots as they were.
- Slots live in `localStorage`: an index under `wime.slots` and each
  save under `wime.slot.<id>` (`web/src/view/save-slots.ts`).
- A save from before named slots, under `wime.archive`, is imported once
  as a slot named Archive, with no saved time, and the old key removed.
- Until the in-game menu (#150), the Archive window saves over and
  restores the slot named Archive, creating it on the first save.

## Autosave

The port also saves the game by itself to a reserved autosave slot
(#148), a departure like the named slots.

- The autosave sits beside the named slots but is not one of them: it is
  not listed among them, cannot be renamed, takes no slot id and does
  not count against them. It is stored under `wime.autosave`, described
  in the slot index, and each autosave writes over the last.
- It is written on each new game hour, on each change of Level, and when
  the page is hidden (`visibilitychange` or `pagehide`)
  (`web/src/view/autosave.ts`).
- It is not written while a fight, an encounter talk or the ending is
  under way, as a restore would not bring back their windows; a point
  passed then is saved once they are over. Meetings, the Council and
  messages do not hold it back: a restore already gives a restored
  meeting or Council a fresh window and drops the messages on screen.
- When the ending starts, the autosave is deleted, so Resume cannot
  return to a game that has ended or is about to end; the original has
  no way back into an ended game (finding:ui-ending-pages). Named slots
  are kept.
- Game Speed and the camera are not saved, as for the named slots.
- A failed autosave is dropped without a message, and play goes on; the
  previous autosave is kept.
- The title menu resumes from the autosave or a named slot
  (docs/spec/title-menu.md), and the in-game menu saves to and loads
  from the slots during play (docs/spec/game-menu.md).
- A page reloaded while a game was in play skips the boot sequence and
  the title menu: the game resumes from the autosave, paused under the
  in-game menu. A session flag, `wime.resume-on-reload` in
  `sessionStorage`, is set when the page is hidden in play and cleared
  when it is hidden on the title, in a Demo or after the ending. If the
  autosave cannot be loaded, the page opens on the boot sequence.
