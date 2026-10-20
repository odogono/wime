# Full Map Level

The overview of the whole of Middle Earth and the windows opened from it.
Facts cite their Findings (ADR-0004); they were recovered by the Full Map
RE (#28).

## Galadriel's Mirror

The eye, or `S`, opens Galadriel's Mirror. A press anywhere, or `S`
again, closes it. Game time stays stopped while it is open, as on the
rest of the Level (`finding:time-stops-on-full-map-level`).

- The window is headed "In the still surface of the pool, you see forces
  moving..." and has two columns: Good on the left, Evil on the right.
  (`finding:ui-galadriels-mirror-lists-forces-on-the-move`)
- An entry is listed only if it is awake, leads its own Force and has a
  destination. Forces standing still are left out. Allegiance is not
  tested, so a moving Good Leader not yet mobilised is listed too.
  (`finding:ui-galadriels-mirror-lists-forces-on-the-move`)
- The Good column takes entries 1 to 77 in roster order. Each listed
  Leader is followed by the entries 1 to 78 that follow it directly, in
  roster order, set 6 pixels to the right. A follower with the same
  name as a row already listed is merged into it, its strength added.
- The Evil column takes entries 79 to 151 in roster order. An entry
  with the same name as a row already listed is merged into it, its
  strength added.
- A Good row is the name, then "is" for a single figure or the summed
  strength and "are" for more than one, then:
  - "following <Leader>." for a follower;
  - "going to <Place>." when the destination is a Place;
  - "heading <direction>." otherwise. The direction is east or west when
    twice the distance across is at least the distance down, north or
    south when twice the distance down is at least the distance across,
    and a diagonal when both hold, by the sign of each;
  - "dead." for a single figure with no strength left, and "All of the
    <name> are dead." for a destroyed Unit.
    (`finding:ui-galadriels-mirror-lists-forces-on-the-move`)
- An Evil row is the name only, with the summed strength in front for
  more than one. A single figure's name starts with a capital: "The
  NAZGUL LORD".
- Each column shows at most 19 rows and drops the rest without saying so.
  This is provisional (`finding:ui-galadriels-mirror-row-limit`).
- At the start of the game the window shows "FRODO is going to GREEN
  HILLS.", "SAM is following FRODO." and "PIPPIN is following FRODO." on
  the left and the nine Nazgûl on the right.
  (`finding:ui-galadriels-mirror-lists-forces-on-the-move`)

The listing is a pure function of the simulation state (ADR-0002); the
window's frame and layout are the view's. The original letters the Full
Map Level's windows in the ROM font topaz/8, and every other window in
the disk font lord/10 (`finding:ui-text-font-lord-10`,
`finding:data-formats-lord-font-metrics`). topaz/8 is not on the game's
disks, so the port draws lord/10 there at double width; this is
provisional.
