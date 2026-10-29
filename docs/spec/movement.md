# Movement

How Forces travel once given an Order: destinations, pace, terrain,
stamina and rest. Facts cite their Findings (ADR-0004). The Reference
runs below were `observed` in the original Amiga v1.0 release
(WHDLoad) under FS-UAE for #6, reading the game clock and roster from
emulator memory, so times are exact quarter-hours. They are the
expected results for headless tests (ADR-0002). Run logs are kept in
`build/fs-uae/runs/` (gitignored, regenerated on demand).

Times are day and quarter-hour counts (`docs/spec/time.md`): day 0 is
23 September 1418 s.r., the game starts at quarter-hour 64, and the
displayed hour names the hour after the one under way (quarter-hour
64 shows as "5 p.m."). Positions are Campaign Level pixels. The tile
under a position is (x ÷ 16, y ÷ 16)
(`finding:map-positions-are-campaign-pixels`).

## Orders

- The player picks a Force, then a destination. The Force finds its
  own route and travels at its own pace
  (`finding:movement-destination-only-orders`). Orders are given only
  on the Campaign Level
  (`finding:movement-only-active-forces-take-orders`).
- Any Good Force on the map can be picked. As it is picked it rolls:
  it takes the Order only if the picked entry's allegiance is above a
  roll of 2 to 97, drawn from the sim's RNG at every attempt. So a
  mobilised Force, 99, always obeys and an unmobilised one, 1, never
  does; Boromir, 70, obeys 68 times in 96. Otherwise "The force will
  not accept your orders." shows, and the arrow stays armed for another
  pick. Where icons overlap, the pick is the lowest-numbered Good
  Force under the click, as the original takes the first Good row in
  roster order, so a Force parked on a Stronghold is picked over its
  Garrison. (`finding:movement-orders-accepted-by-allegiance-roll`)
- Accepted for 1.0: the original keeps the refused pick and seems to
  roll again once the refusal's box has had its time; the port drops
  the pick instead, and the player picks again. The re-roll is read
  from code but not observed, re-picking takes one click, and each
  attempt rolls the same odds.
  (`finding:movement-orders-accepted-by-allegiance-roll`)
- Port additions, not in the original: pressing the arrow while a
  Good Force's info window is open picks that Force at once, rolling
  as above; with no Force shown, "Click a Force to order" asks for
  one. Once the destination is clicked, the ordered entry's status
  line ("ÉOMER is going to EDORAS.", or "heading <direction>." away
  from a Place) shows as a plain notice to confirm the Order.
- An Order's destination is the clicked spot rounded down to its
  tile origin, so a click in a Place's tile lands on the Place.
  Clicking near Bree set (784, 384); clicking near Osgiliath set
  (1632, 1184).
  (`finding:movement-destination-is-the-clicked-tile`)
- `observed`: on arrival the destination clears to (0, 0) and the
  Force stays where it stopped.
- On arrival the entry turns resting and takes the next stop off its
  Default Orders route; the destination only clears when that route
  is empty (`finding:movement-arrival-pops-next-route-stop`).
- A Nazgûl, entries 79 to 87, whose orders end on Place 22, the Ford
  of Bruinen, goes to sleep (state 0) instead of resting, with its
  trigger set to the Ring-bearer test: it has no Full Map dot or
  Campaign Level icon, takes no part in fights, and wakes when the
  Ring-bearer's Force comes within 9 pixels on each axis
  (`finding:forces-nazgul-hide-at-ford-of-bruinen`,
  `finding:ai-trigger-distances-are-square`).
  Arrival is tested exactly on the destination pixel at a tile
  origin, so a destination that is not tile-aligned can never be
  arrived at.
- A Leader among roster entries 1 to 78 arriving at a Place shows a
  box: "<name> has reached <Place>.", with "have" for a strength
  above 1. Nothing is shown at the Grey Havens, the Barrow Downs,
  Rivendell or Lórien, nor for the Nazgûl and the Evil Units
  (`finding:movement-arrival-announced-except-at-four-places`).
- Ordering part of a Force: clicking a Character in the Order
  window gives the Order to that Character and all of its
  followers, splitting them off from the rest of the Force
  (`finding:forces-ordering-a-follower-splits-it`). The split-off
  member becomes a Leader with its top Leader's position and facing,
  and loses its Default Orders: its route is emptied. Entries whose
  leader chain runs through it go with it. A Unit that follows
  someone cannot be ordered on its own. Giving an Order sets the
  ordered entry moving (state 1) even if it was resting; if its
  stamina is 0 it rests again on the next tick.

## Pace

- Each roster entry has a speed class, 0 to 5. Per step (one step per
  quarter-hour) it moves 336, 372, 414, 460 or 512 256ths of a pixel
  along the axes for classes 1 to 5, and about 1/√2 of that per axis
  on diagonals (`finding:movement-speed-classes`).
- `observed`: the full speed-class pace applies on road and track
  tiles: 1.31 px/tick for Frodo's Force (class 1) east along the road
  at y = 384 (tile 105 and neighbours), 1.62 px/tick for Faramir
  (class 3) south along the Ithilien track at x = 1648 (tile 104),
  with diagonal movement at 2.28 px/tick Manhattan for class 3.
  Tolerance ±0.15 px/tick on sampled segments.
- Every tile has a terrain value from 5 to 100, and the step's pace
  is the speed-class pace times that value over 100, read at the
  tile under the entry's centre (position + 8). The sim reads it
  from the vector Terrain Regions, which carry each tile's value
  exactly (ADR-0006), and reads the open sea's 5 beyond the map's
  edge, as the original reads tile 0 there. Roads and
  tracks (tiles 104, 105 and their neighbours) are among the 44
  tiles rated 100; plain (33) and the Ithilien woods (229, 247)
  are rated 60, so Éomer's class-4 pace there is
  460 × 60 ⁄ 100 ⁄ 256 ≈ 1.08 px/tick. No tile is rated 0.
  (`finding:movement-terrain-percent-scales-pace`) The
  `observed` paces below fit this: about 1 px/tick off road was
  the 60% rate sampled over mixed segments.
- A step that would move 2 pixels moves only 1 when that pixel
  lands exactly on a tile origin
  (`finding:movement-step-moves-to-tile-origin`).
- `observed`: a mixed Force moves at its leader's pace, not the
  slowest member's. Faramir (class 3) leading his Rangers (entry 16,
  class 2) covered the second leg to Osgiliath in 31 steps, which
  fits class 3 (about 31 steps) and not class 2 (about 34, more than
  his 32 stamina). Followers keep no position of their own while
  following. (`finding:movement-mixed-force-at-leader-pace`)
- `observed`: on the Animation Level the watched Character takes
  extra steps (2 steps within one quarter-hour at the start), so
  Reference runs are recorded on the Campaign Level.

## Stamina and rest

- Moving costs 1 stamina point a step unless the maximum is 255.
  A resting entry (state 3) regains 2 points a step, and once full
  it sets off again by a 1-in-10 chance each step while the
  quarter-hour count is between 21 and 51
  (`finding:movement-stamina-and-rest`).
- `observed`: a Force stops to rest when its _leader's_ stamina
  reaches 0. Frodo (40 maximum) rests after 40 steps; Sam's and
  Pippin's stamina stays at 32/32 throughout. Faramir rests after
  his 32 steps. Followers' stamina does not change while following.
  (`finding:movement-rest-when-leader-stamina-empty`)
- `observed`: resuming is random inside the morning window. In two
  runs of the same journey Frodo resumed between quarter-hours 36
  and 38, then earlier the next day; Faramir resumed between
  quarter-hours 19 and 25 with his stamina already full. Arrival
  tolerances below cover this: expect up to ±8 quarter-hours (2
  hours) from the resume roll, while rest _positions_ are exact.

## Rivers and route-finding

- Steering happens only at tile origins. The entry computes a
  desired facing toward its destination (an axis only counts when
  twice its distance beats the other axis), then scores the eight
  neighbouring tiles as terrain value × a facing weight (100, 69,
  39, 19, 9 by angular distance from desired), with a reverse
  step's score divided by 8 — only for current facings 0–3, a
  quirk of the original comparison. One time in ten it takes the
  desired facing directly if the next tile's terrain is at least 10. There is no search beyond the neighbouring tiles
  (`finding:movement-greedy-tile-steering`).
- `observed`: a Force whose way is blocked by low-rated river
  tiles walks the bank and loops, keeping its Order. Éomer,
  ordered from East Emnet to Edoras, reached the west bank of the
  Entwash at x = 1328, walked north along it to about (1328, 945),
  then returned south-east to about (1341, 960) and west again,
  looping for four days without arriving. This is the greedy
  steering above: no tile is impassable in the code, but a river
  tile ahead scores under the bank tiles to either side. Our
  seeded RNG is not the original's (ADR-0002), so a run may
  eventually blunder across where the observed run did not; the
  Reference run's expected result is the looping, not a guarantee.
  (`finding:movement-greedy-tile-steering`)
- Under Crossing movement, the default, a Force heads for a Crossing
  instead (`docs/spec/crossing-movement.md`). This section and the
  Reference runs describe Classic movement.

## Reference runs

Each Reference run starts from the game's starting state on the Campaign
Level. Orders were given in the game's own UI. Game Speed in the
original was left at its starting setting throughout; the emulator's
warp mode was used to pass real time faster in later runs, which does
not change the simulation (run 2 below reproduces run 1 rest
positions exactly). The in-game Game Speed setting was not varied:
whether it changes anything but real time is still unobserved.

### S1. Frodo's Force, Hobbiton → Bree

`observed` (two runs; run 1 at normal emulator speed, run 2 with
warp). Frodo (entry 7, class 1, stamina 40) with Sam and Pippin
following. Order given day 0, quarter-hour 65, at (640, 368);
destination (784, 384), Bree's Place position.

| When (day, quarter-hour) | Event                                                  | Position   |
| ------------------------ | ------------------------------------------------------ | ---------- |
| 0, 65                    | Order given                                            | (640, 370) |
| 0, 68–78                 | South-east to the road, off-road pace                  | (642, 384) |
| 0, 89                    | Radagast Encounter; chose "Continue on"                | (656, 384) |
| 1, 7                     | Stamina 0/40, stops to rest                            | (673, 384) |
| 1, 29                    | Stamina full again                                     | (673, 384) |
| 1, 36–38                 | Sets off again (run 1)                                 | (673, 384) |
| 1, 78                    | Stamina 0/40, stops to rest                            | (724, 384) |
| 2, 0–16                  | Attacked by the 4th Nazgûl while resting; journey ends | (724, 384) |

The Force follows the road east at y = 384 at 1.31 px/tick. It does
not reach Bree: in both runs a Nazgûl attack during the second rest
ends the journey 60 pixels short. The order was given after one
tick of Frodo's starting walk south, which had spent 1 stamina and
carried a fraction of 80/256; starting a headless run from that
state reproduces both rest positions exactly. Uninterrupted, the
remaining 60 pixels need some 46 steps, more than Frodo's 40
stamina, so a third rest intervenes and arrival falls on day 3,
not day 2 as first extrapolated from the samples. A headless test
should assert the rests and pace rather than the arrival, since
the Nazgûl are part of the starting state.

### S2. Faramir and his Rangers, North Ithilien → Osgiliath

`observed`. Faramir (entry 15, class 3, stamina 32) leading Rangers
(entry 16, class 2). Order given day 0, quarter-hour 72, at
(1632, 1104); destination (1632, 1184), Osgiliath's Place position.

| When (day, quarter-hour) | Event                                                 | Position     |
| ------------------------ | ----------------------------------------------------- | ------------ |
| 0, 72                    | Order given                                           | (1632, 1104) |
| 0, 80–92                 | South-east through woods at reduced pace              | (1648, 1121) |
| 0, 92 – 1, 7             | South on the track at 1.62 px/tick; stamina reaches 0 | (1648, 1141) |
| 1, 19–25                 | Sets off again, stamina full                          | (1648, 1141) |
| 1, 57                    | Arrives; destination clears; stamina 1/32             | (1632, 1184) |

Arrival day 1, quarter-hour 57 (24 September, 3 p.m. on the
display), tolerance ±8 quarter-hours. The mixed Force keeps the
leader's class-3 pace (see Pace).

### S3. Éomer's cavalry, East Emnet → Edoras (does not arrive)

`observed`. Éomer (entry 13, class 4, stamina 40) leading cavalry
(entry 14, class 4). Order given day 0, quarter-hour 69, at
(1360, 960); destination (1248, 992), Edoras' Place position.

| When (day, quarter-hour) | Event                                                                                      | Position        |
| ------------------------ | ------------------------------------------------------------------------------------------ | --------------- |
| 0, 69                    | Order given                                                                                | (1359, 960)     |
| 0, 80 – 1, 7             | West across plain at about 1 px/tick; stamina reaches 0                                    | (1329, 945)     |
| 1, 31–36                 | Sets off; loops south-east then west                                                       | (1341, 960)     |
| 1, 75 – 3, 90            | Loop repeats daily: bank at x = 1328, north to y ≈ 945, back to y ≈ 960, rest each evening | (1328, 946–951) |
| 4, 27                    | Still looping when the run was stopped                                                     | (1328, 951)     |

A cavalry Force off-road is no faster than Frodo's off-road: about
1 px/tick, well under the class-4 road pace of 1.80 px/tick. The
Reference run's expected result is non-arrival: after 4 days the Force
is still on the east bank of the Entwash with its destination set.

### S4. Terrain pace comparison

`observed`, from the segment data of S1–S3. The same Force changes
pace with the tile under it, and speed class only sets the pace on
road and track tiles.

| Segment                         | Tiles         | Class | Pace (px/tick)                  |
| ------------------------------- | ------------- | ----- | ------------------------------- |
| Frodo south to the road         | 62            | 1     | about 1.0                       |
| Frodo east on the road          | 105, 142, 110 | 1     | 1.31                            |
| Faramir through woods, diagonal | 229, 247      | 3     | about 1.7 Manhattan (0.85/axis) |
| Faramir south on the track      | 104           | 3     | 1.62                            |
| Faramir diagonal on the track   | 104, 120      | 3     | 2.28 Manhattan (1.14/axis)      |
| Éomer west on plain             | 33            | 4     | about 1.0                       |
| Éomer diagonal on plain         | 33            | 4     | about 2.0 Manhattan (1.0/axis)  |
| Éomer at the Entwash            | 228, 244, 247 | 4     | does not cross                  |

Tolerances: ±0.15 px/tick per segment. The tile-to-terrain table
is now recovered (`finding:movement-terrain-percent-scales-pace`):
rows above are the speed-table pace times terrain ⁄ 100 (62, 105,
104 and 120 are rated 100; 33, 229 and 247 are rated 60), sampled
over segments that sometimes cross into neighbouring tiles, which
is why the sampled diagonal paces sit between the pure per-tile
values. A headless test asserts each row on a uniform tile of
that rating.
