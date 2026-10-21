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
- Slots can be listed, saved into, saved over (keeping their name),
  loaded, renamed and deleted. An empty name becomes `Save <n>`. Slot
  ids are never reused.
- A save of another `SAVE_VERSION` is listed but cannot be loaded, as
  the single slot refused it before.
- Storage that is full or unavailable is reported as a failure, never
  thrown; a failed save leaves the existing slots as they were.
- Slots live in `localStorage`: an index under `wime.slots` and each
  save under `wime.slot.<id>` (`web/src/view/save-slots.ts`).
- A save from before named slots, under `wime.archive`, is imported once
  as a slot named Archive, with no saved time, and the old key removed.
- Until the in-game menu (#150), the Archive window saves over and
  restores the slot named Archive, creating it on the first save.
