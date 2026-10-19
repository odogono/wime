# Movement

How Forces travel once given an Order: destinations, pace, terrain,
stamina and rest. Facts cite their Findings (ADR-0004). The reference
scenarios below were `observed` in the original Amiga v1.0 release
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
  (`finding:movement-destination-only-orders`). Only active Forces
  take Orders, and only on the Campaign Level
  (`finding:movement-only-active-forces-take-orders`).
- `observed`: clicking in a Place's tile sets the destination to that
  Place's own position. Clicking near Bree set (784, 384); clicking
  near Osgiliath set (1632, 1184).
  (`finding:movement-destination-snaps-to-place`)
- `observed`: on arrival the destination clears to (0, 0) and the
  Force stays where it stopped.

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
- `observed`: off road and track tiles, pace is about 1 px/tick,
  on diagonals about 1 px/tick per axis: Frodo's Force heading south
  from Hobbiton to the road (tile 62), Éomer's cavalry (class 4)
  west across the plain (tile 33), and Faramir's first leg through
  the woods of North Ithilien (tiles 229, 247) all show this. Which
  tiles count as road or track, and whether other terrain has its
  own pace, is not yet recovered.
  (`finding:movement-terrain-limits-pace`)
- `observed`: a mixed Force moves at its leader's pace, not the
  slowest member's. Faramir (class 3) leading his Rangers (entry 16,
  class 2) covered the second leg to Osgiliath in 31 steps, which
  fits class 3 (about 31 steps) and not class 2 (about 34, more than
  his 32 stamina). Followers keep no position of their own while
  following. (`finding:movement-mixed-force-at-leader-pace`)
- `observed`: on the Animation Level the watched Character takes
  extra steps (2 steps within one quarter-hour at the start), so
  scenarios are recorded on the Campaign Level.

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

- `observed`: river tiles are impassable away from crossings, and
  the route-finder does not search far for one. Éomer, ordered from
  East Emnet to Edoras, reached the west bank of the Entwash at
  x = 1328, walked north along it to about (1328, 945), then
  returned south-east to about (1341, 960) and west again, looping
  for four days without arriving. His destination stayed set the
  whole time. (`finding:movement-rivers-block-route-finding`)

## Reference scenarios

Each scenario starts from the game's starting state on the Campaign
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
ends the journey 60 pixels short. Uninterrupted, the same timings
put arrival around day 2, quarter-hour 55 (25 September, about
2 p.m. on the display), tolerance ±8 quarter-hours. A headless test
should assert the rests and pace rather than the arrival, since the
Nazgûl are part of the starting state.

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
scenario's expected result is non-arrival: after 4 days the Force
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

Tolerances: ±0.15 px/tick per segment. A headless test can assert
the row for its tile and class once the tile-to-terrain table is
recovered; until then these rows are the recorded reference values.
