# Starting state

What the simulation holds when a new game begins: the clock, every Character and Unit, how they are grouped into Forces, the Places and the objects. Rules that later change this state, such as movement, triggers and Encounters, belong to their own Specs. This Spec only fixes the values and their meaning at the start.

## Source

The starting state comes from the Reference Build's data hunk, which the game loads as its starting state with no code to build it (finding:data-formats-archive-dat-is-roster-dump). `bun run export:web` writes it to `web/public/assets/starting-state.json` through `tools/extract-starting-state.ts`. The simulation must load that file rather than copy its values into code, so the starting state can't drift from the Reference Build. The tables below are generated from the same file, for review.

## Positions

- All positions are pixels on the 2,560 by 1,584 Campaign Level map, and the tile under a position is (x ÷ 16, y ÷ 16) (finding:map-positions-are-campaign-pixels).
- A position of 0, 0 means "none": followers have no position of their own, and an entry with no destination has destination 0, 0.

## Clock

- The game starts on day 0, 23 September 1418 S.R., at quarter-hour 64 of the day (finding:time-clock-counts-quarter-hours, finding:time-quest-starts-23-september).
- The clock counts 96 quarter-hours a day, and the simulation's fixed tick is one quarter-hour. In the original, one tick is one step for every awake Force (finding:time-clock-advances-after-each-roster-sweep). This replaces the provisional one-hour tick.
- The date display shows the hour after the one under way, so the opening time reads "5 p.m." (finding:time-clock-counts-quarter-hours).
- The calendar runs from September 1418 to April 1419. Its months start on days −22, 8, 38, 68, 100, 130, 160 and 190, so December has 32 days and the year changes on day 100 (finding:time-calendar-september-to-april).

## Roster

The roster is a list of 195 entries, numbered 1 to 195 as in the original, because routes, leaders and the Ring-bearer refer to entries by number (finding:forces-roster-order). Each entry carries:

- name, starting strength and strength. An entry is a Unit if its starting strength is above 1, otherwise a Character (finding:forces-units-have-strength-above-one).
- position, destination, facing, state (asleep, moving or resting), speed class, stamina and maximum stamina (finding:data-formats-roster-record-layout, finding:movement-speed-classes, finding:movement-stamina-and-rest).
- health and maximum health (finding:forces-health) and fighting strength.
- allegiance: 0 Evil, 1 Good but not mobilised, 99 mobilised (finding:mobilisation-allegiance-byte).
- leader (finding:forces-leader-byte-forms-forces), Default Orders route (finding:ai-default-orders-are-place-queues) and trigger (finding:ai-trigger-conditions).
- objects carried (finding:objects-carried-as-a-bitmask), Campaign Level icon (finding:graphics-campaign-icon-index, finding:graphics-campaign-icon-sheet-is-imag-100) and Animation Level figure.

Only entries 1 to 151 take part in the main loop. Entries 152 to 195 are Encounter figures: instead of a position and destination they have an area, a chance out of 100 and a first day, and they never move (finding:forces-encounter-figures-wait-in-areas).

## Forces

- A Force is an entry with no leader together with every entry whose chain of leaders ends at it. The Force is at its leader's position (finding:forces-leader-byte-forms-forces).
- Entries 1 to 151 make 123 Forces. 42 have an awake leader and are on the map at the start; the other 81 are asleep at their positions and are not drawn until triggered (finding:forces-starting-forces-on-the-map).
- At the start the player commands Frodo's Force: Frodo, Sam and Pippin at Hobbiton, with the Ring (finding:forces-starting-fellowship, finding:objects-ring-starts-with-frodo). Frodo is the Ring-bearer (data+0x3e6a holds entry 7).
- The tables at the end list every Force.

## Places

- There are 69 named Places, numbered 1 to 69, each with a position and, except Green Hills and the Rammas forts, a grid reference on the printed map (finding:places-named-places-matched-by-position, finding:places-grid-reference-byte).
- A point is at a named Place only if its tile is the Place's tile.
- Seventeen Places announce attacks on them (finding:places-attacks-announced-at-key-places).
- Any other point whose map tile is one of 15 tiles is a Place of a generic kind, such as "a small town" (finding:places-kinds-matched-by-map-tile).

## Default Orders and triggers

- Each entry's Default Orders are a queue of up to eight Place numbers, from the route table in the starting state, where 77 of the 85 rows hold a queue (finding:ai-default-orders-are-place-queues). Taking the next stop sets the entry's destination to that Place.
- At the start the event mask is 0x05 and every event day is 0, so only the "Ring-bearer near" and "Gandalf near" triggers can fire until a war event happens (finding:ai-trigger-conditions, finding:ai-war-events-set-once).

## Objects

- Frodo carries the Ring and an Elven blade, and Aragorn an Ancient sword. No one else carries anything (finding:objects-carried-as-a-bitmask).
- 25 objects lie on the map at the positions in `object_placements`, among them the Tokens: the Dwarven Ring, the Red Arrow, the sceptre and the silver orb (finding:objects-starting-placements, finding:mobilisation-token-table).

## Left out

- The port has no copy protection. The original asks for the map coordinates of a Place from day 92 and ends the game on a wrong answer (finding:places-grid-reference-byte); the port never asks. The grid references stay in the starting state as data only.

## Settled points

Every roster byte now has a meaning: byte 37 is padding (finding:data-formats-roster-byte-37-is-padding). Allegiance is the chance a Force accepts an Order (finding:movement-orders-accepted-by-allegiance-roll), and only the trigger, the Council of Elrond, the Silver Orb and the 3rd Nazgûl's call wake a sleeping entry (finding:ai-what-wakes-an-entry). Game Speed is in `docs/spec/time.md`. The last open points were settled in #200:

- Named Places have no kind, and the original never shows one: wherever it shows a Place it prints only the record's name. A kind is only the name of a generic record 70 to 84, which names a point on its tile that is not a named Place (finding:places-named-places-show-only-their-name, finding:places-kinds-matched-by-map-tile). The "Kind from tile" column below is the port's own inference, not an attribute of the original, and the simulation must not rely on it.
- Bree's town graphic covers two small-town tiles, and its Place position is the western one. The game uses the position as it is: a point on the eastern tile is "a small town" (finding:map-bree-place-is-the-town-west-tile).
- A roster entry's Animation Level figure byte below 20 is the id of its FRML figure set (finding:graphics-figure-byte-is-the-frml-id).
- A Campaign Level icon (finding:graphics-campaign-icon-sheet-is-imag-100) is cut onto the map with colour 0 clear, its top-left corner 4 pixels above the Force's position (finding:graphics-campaign-icons-cookie-cut-on-colour-0). The icons of leaders with allegiance above 2 flip between shown and hidden at each Campaign Level redraw: every 64 frames while the clock waits, at each quarter-hour step on Hasty, each hour on Very Hasty, and about every 4 frames while the map scrolls (finding:ui-campaign-icons-flash-at-each-redraw).

## Places at the start

Positions and grid references from finding:places-named-places-matched-by-position and finding:places-grid-reference-byte. "Kind from tile" is the port's inference noted under Settled points.

| Place | Name               | x, y       | Grid | Attacks announced | Kind from tile  |
| ----: | ------------------ | ---------- | ---- | ----------------- | --------------- |
|     1 | ANNUMINAS          | 640, 272   | B3   |                   | a ruin          |
|     2 | HOBBITON           | 640, 368   | B3   |                   |                 |
|     3 | WAYMEET            | 624, 384   | B3   |                   | a small town    |
|     4 | TUCKBOROUGH        | 640, 400   | C3   |                   | a small town    |
|     5 | MICHEL DELVING     | 576, 400   | B3   |                   | a small town    |
|     6 | FORLOND            | 176, 352   | C1   |                   | a small town    |
|     7 | BELEGOST           | 352, 224   | B2   |                   | a ruin          |
|     8 | WHITE TOWERS       | 480, 400   | B3   |                   | a ruined castle |
|     9 | GREY HAVENS        | 416, 400   | C2   |                   | a large town    |
|    10 | WOODHALL           | 688, 400   | C3   |                   |                 |
|    11 | BUCKLAND           | 704, 416   | C3   |                   | a small town    |
|    12 | BOMBADIL'S HOUSE   | 752, 416   | C3   |                   |                 |
|    13 | BARROW DOWNS       | 768, 416   | C3   |                   |                 |
|    14 | STONEBOWS BRIDGE   | 704, 384   | B3   |                   |                 |
|    15 | DEADMAN'S DIKE     | 752, 256   | B3   |                   |                 |
|    16 | BREE               | 784, 384   | B3   |                   | a small town    |
|    17 | SARN FORD          | 720, 496   | C3   |                   |                 |
|    18 | MIDGEWATER MARSH   | 848, 368   | B4   |                   |                 |
|    19 | WEATHERTOP         | 928, 384   | B4   |                   |                 |
|    20 | THE LAST BRIDGE    | 1072, 400  | B4   |                   |                 |
|    21 | MOUNT GRAM         | 1104, 176  | A4   |                   | a ruined castle |
|    22 | FORD OF BRUINEN    | 1200, 400  | B4   |                   |                 |
|    23 | RIVENDELL          | 1216, 384  | B4   | yes               |                 |
|    24 | MT. GUNDABAD       | 1280, 144  | A4   |                   | a ruined castle |
|    25 | GOBLIN TOWN        | 1312, 336  | B4   |                   | a ruined castle |
|    26 | THRANDUIL'S PALACE | 1696, 240  | B6   | yes               | a small town    |
|    27 | EREBOR             | 1744, 224  | B6   | yes               |                 |
|    28 | DALE               | 1744, 256  | B6   | yes               |                 |
|    29 | IRON HILLS         | 1984, 256  | A8   | yes               |                 |
|    30 | OST-IN-EDHIL       | 1024, 608  | C4   |                   | a ruin          |
|    31 | HOLLIN GATE        | 1168, 592  | C4   |                   |                 |
|    32 | DIMRILL DALE       | 1216, 592  | C4   |                   |                 |
|    33 | LORIEN             | 1344, 656  | C5   | yes               |                 |
|    34 | DOL GULDUR         | 1456, 672  | C5   |                   |                 |
|    35 | DERNDINGLE         | 1168, 848  | D4   |                   | a small town    |
|    36 | ISENGARD           | 1088, 896  | D4   |                   |                 |
|    37 | ISEN FORD          | 1104, 928  | D4   |                   |                 |
|    38 | ROHAN              | 1168, 912  | D4   |                   |                 |
|    39 | HORNBURG           | 1168, 960  | D4   | yes               | a castle        |
|    40 | EDORAS             | 1248, 992  | D4   | yes               | a castle        |
|    41 | DUNHARROW          | 1216, 1040 | D4   |                   |                 |
|    42 | EAST EMNET         | 1360, 960  | D5   |                   |                 |
|    43 | NORTH RHUN         | 2272, 576  | C9   |                   |                 |
|    44 | SOUTH RHUN         | 1776, 992  | D8   |                   |                 |
|    45 | MINAS TIRITH       | 1616, 1184 | E6   | yes               |                 |
|    46 | OSGILIATH          | 1632, 1184 | E6   |                   |                 |
|    47 | CAIR ANDROS        | 1600, 1136 | E6   |                   |                 |
|    48 | NORTH ITHILIEN     | 1632, 1104 | E6   |                   |                 |
|    49 | DOL AMROTH         | 1168, 1296 | F5   | yes               |                 |
|    50 | LOSSARNACH         | 1600, 1200 | E6   | yes               |                 |
|    51 | ETHRING            | 1344, 1200 | E5   | yes               | a small town    |
|    52 | ERECH              | 1232, 1136 | E5   | yes               | a large town    |
|    53 | ANFALAS            | 896, 1264  | F4   | yes               | a small town    |
|    54 | PINNATH GELIN      | 944, 1200  | E4   | yes               |                 |
|    55 | CALEMBEL           | 1296, 1168 | E5   | yes               | a small town    |
|    56 | LINHIR             | 1360, 1312 | F5   | yes               | a small town    |
|    57 | PELARGIR           | 1552, 1328 | F6   | yes               | a small town    |
|    58 | MORANNON           | 1744, 1008 | D6   |                   |                 |
|    59 | DAGORLAD           | 1728, 992  | D6   |                   |                 |
|    60 | DURTHANG           | 1712, 1072 | E7   |                   | a ruined castle |
|    61 | MINAS MORGUL       | 1664, 1168 | E7   |                   | an evil citadel |
|    62 | CIRITH UNGOL       | 1744, 1168 | E7   |                   | an evil citadel |
|    63 | CARACH ANGREN      | 1760, 1072 | E7   |                   | an evil citadel |
|    64 | MT. DOOM           | 1808, 1120 | E7   |                   |                 |
|    65 | BARAD-DUR          | 1856, 1120 | E7   |                   |                 |
|    66 | NURN               | 1968, 1296 | F7   |                   |                 |
|    67 | THE HARAD ROAD     | 1584, 1504 | G6   |                   |                 |
|    68 | GREEN HILLS        | 656, 400   | –    |                   |                 |
|    69 | RAMMAS FORTS       | 1624, 1184 | –    |                   |                 |

## Forces on the map at the start

Strengths of Units are in brackets. Trigger is the condition that mobilises an awake Force or wakes a sleeping one (finding:ai-trigger-conditions).

| Leader                 | Followers                           | x, y       | At                 | Allegiance | Trigger           |
| ---------------------- | ----------------------------------- | ---------- | ------------------ | ---------: | ----------------- |
| 7 FRODO                | SAM, PIPPIN                         | 640, 368   | Hobbiton           |         99 |                   |
| 13 EOMER               | cavalry (120)                       | 1360, 960  | East Emnet         |         99 |                   |
| 15 FARAMIR             | Rangers (200)                       | 1632, 1104 | North Ithilien     |         99 |                   |
| 17 DAIN                | dwarves (1000)                      | 1744, 224  | Erebor             |          1 | event 6 + 0 days  |
| 19 BRAND               | infantry (400), lt. infantry (600)  | 1744, 256  | Dale               |          1 | event 6 + 0 days  |
| 22 THRANDUIL           | elves (800)                         | 1696, 240  | Thranduil's Palace |          1 | event 6 + 0 days  |
| 26 THEODEN             | cavalry (960)                       | 1248, 992  | Edoras             |          1 | Gandalf near      |
| 28 THEODRED            | cavalry (120)                       | 1104, 928  | Isen Ford          |          1 | event 5 + 0 days  |
| 30 ERKENBRAND          | cavalry (1200)                      | 1168, 960  | Hornburg           |          1 | event 5 + 0 days  |
| 32 DENETHOR            | tower guards (100), infantry (1500) | 1616, 1184 | Minas Tirith       |          1 | event 3           |
| 42 IMRAHIL             | knights (500), men at arms (700)    | 1168, 1296 | Dol Amroth         |          1 | event 3           |
| 58 dwarves (500)       |                                     | 1984, 256  | Iron Hills         |          1 | event 6 + 0 days  |
| 67 lt. infantry (1000) |                                     | 1248, 992  | Edoras             |          1 |                   |
| 68 lt. infantry (1000) |                                     | 1168, 960  | Hornburg           |          1 |                   |
| 69 infantry (100)      |                                     | 1624, 1184 | Rammas Forts       |          1 | event 3           |
| 70 infantry (400)      |                                     | 1632, 1184 | Osgiliath          |          1 | event 3           |
| 71 infantry (100)      |                                     | 1600, 1136 | Cair Andros        |          1 | event 3           |
| 74 infantry (500)      |                                     | 1360, 1312 | Linhir             |          1 | event 3           |
| 76 infantry (200)      |                                     | 1552, 1328 | Pelargir           |          1 | event 3           |
| 79 the NAZGUL LORD     |                                     | 608, 464   | near Waymeet       |          0 |                   |
| 80 the 2nd NAZGUL      |                                     | 624, 432   | near Waymeet       |          0 |                   |
| 81 the 3rd NAZGUL      |                                     | 640, 360   | near Hobbiton      |          0 |                   |
| 82 the 4th NAZGUL      |                                     | 640, 400   | Tuckborough        |          0 |                   |
| 83 the 5th NAZGUL      |                                     | 752, 512   | near Sarn Ford     |          0 |                   |
| 84 the 6th NAZGUL      |                                     | 736, 496   | near Sarn Ford     |          0 |                   |
| 85 the 7th NAZGUL      |                                     | 736, 480   | near Sarn Ford     |          0 |                   |
| 86 the 8th NAZGUL      |                                     | 752, 496   | near Sarn Ford     |          0 |                   |
| 87 the 9th NAZGUL      |                                     | 736, 512   | near Sarn Ford     |          0 |                   |
| 90 hand orcs (2500)    |                                     | 1088, 896  | Isengard           |          0 | event 4 + 7 days  |
| 91 uruk-hai (1500)     |                                     | 1088, 896  | Isengard           |          0 | event 4 + 7 days  |
| 92 Dunlendings (2000)  |                                     | 1088, 896  | Isengard           |          0 | event 4 + 7 days  |
| 128 orcs (5000)        |                                     | 1808, 1120 | Mt. Doom           |          0 | event 7 + 12 days |
| 140 orcs (500)         |                                     | 1280, 144  | Mt. Gundabad       |          0 |                   |
| 141 orcs (500)         |                                     | 1312, 336  | Goblin Town        |          0 |                   |
| 142 orcs (500)         |                                     | 1216, 592  | Dimrill Dale       |          0 |                   |
| 143 orcs (1000)        |                                     | 1456, 672  | Dol Guldur         |          0 |                   |
| 144 orcs (10000)       |                                     | 1744, 1008 | Morannon           |          0 |                   |
| 145 orcs (3400)        |                                     | 1760, 1072 | Carach Angren      |          0 |                   |
| 146 orcs (10000)       |                                     | 1664, 1168 | Minas Morgul       |          0 |                   |
| 147 orcs (2500)        |                                     | 1744, 1168 | Cirith Ungol       |          0 |                   |
| 148 orcs (9500)        |                                     | 1856, 1120 | Barad-Dur          |          0 |                   |
| 149 trolls (500)       |                                     | 1856, 1120 | Barad-Dur          |          0 |                   |

## Forces asleep at the start

These are not drawn until triggered (finding:forces-starting-forces-on-the-map).

| Leader                 | Followers                          | x, y       | At                      | Allegiance | Trigger           |
| ---------------------- | ---------------------------------- | ---------- | ----------------------- | ---------: | ----------------- |
| 1 GANDALF              | BOROMIR, LEGOLAS, GIMLI            | 1216, 380  | near Rivendell          |         99 | event 6 + 0 days  |
| 2 GANDALF'             |                                    | 1344, 656  | Lorien                  |         99 | event 1           |
| 3 ELROND               |                                    | 1208, 392  | near Ford Of Bruinen    |          3 | Ring-bearer near  |
| 4 GLORFINDEL           |                                    | 1104, 396  | near The Last Bridge    |          4 | Ring-bearer near  |
| 5 ARAGORN              |                                    | 784, 380   | near Bree               |         99 | Ring-bearer near  |
| 9 MERRY                |                                    | 704, 414   | near Buckland           |         99 | Ring-bearer near  |
| 24 CELEBORN            | elves (800)                        | 1344, 655  | near Lorien             |          1 | event 6 + 9 days  |
| 35 DERNHELM            |                                    | 1248, 992  | Edoras                  |         99 | event 5 + 0 days  |
| 36 ELFHELM             | cavalry (2300)                     | 1248, 992  | Edoras                  |         99 | event 5 + 2 days  |
| 38 GRIMBOLD            | cavalry (2300)                     | 1248, 992  | Edoras                  |         99 | event 5 + 3 days  |
| 40 DUNHERE             | cavalry (2300)                     | 1248, 992  | Edoras                  |         99 | event 5 + 4 days  |
| 45 FORLONG             | men at arms (200)                  | 1600, 1200 | Lossarnach              |         99 | event 3           |
| 47 DERVORIN            | infantry (300)                     | 1344, 1200 | Ethring                 |         99 | event 3           |
| 49 DUINHIR             | infantry (500)                     | 1232, 1136 | Erech                   |         99 | event 3           |
| 51 GOLASGIL            | infantry (100), lt. infantry (400) | 896, 1264  | Anfalas                 |         99 | event 3           |
| 54 HIRLUIN             | infantry (300)                     | 944, 1200  | Pinnath Gelin           |         99 | event 3           |
| 56 elven guards (60)   |                                    | 1216, 380  | near Rivendell          |          1 | event 6 + 0 days  |
| 57 Rangers (20)        |                                    | 1056, 912  | near Isengard           |         99 | event 4 + 0 days  |
| 59 elves (500)         |                                    | 1344, 656  | Lorien                  |          1 | event 6 + 0 days  |
| 60 elves (1000)        |                                    | 1344, 655  | near Lorien             |          1 | event 6 + 2 days  |
| 61 elves (1000)        |                                    | 1344, 655  | near Lorien             |          1 | event 6 + 10 days |
| 62 elves (1000)        |                                    | 1696, 239  | near Thranduil's Palace |          1 | event 6 + 1 days  |
| 63 elves (500)         |                                    | 1696, 239  | near Thranduil's Palace |          1 | event 6 + 4 days  |
| 64 elves (500)         |                                    | 1696, 239  | near Thranduil's Palace |          1 | event 6 + 9 days  |
| 65 ents (1000)         |                                    | 1168, 848  | Derndingle              |          2 | Gandalf near      |
| 66 huorns (1000)       |                                    | 1168, 848  | Derndingle              |          2 | Gandalf near      |
| 72 infantry (800)      |                                    | 1344, 1199 | near Ethring            |         99 | event 3           |
| 73 infantry (1000)     |                                    | 1296, 1167 | near Calembel           |         99 | event 3           |
| 75 infantry (2000)     |                                    | 1360, 1311 | near Linhir             |         99 | event 3           |
| 77 infantry (800)      |                                    | 1552, 1327 | near Pelargir           |         99 | event 3           |
| 78 GOLLUM              |                                    | 1168, 592  | Hollin Gate             |         40 | Ring-bearer near  |
| 88 hand orcs (150)     |                                    | 1088, 896  | Isengard                |          0 | event 4 + 0 days  |
| 89 hand orcs (150)     |                                    | 1088, 896  | Isengard                |          0 | event 4 + 0 days  |
| 93 hand orcs (2000)    |                                    | 1088, 895  | near Isengard           |          0 | event 4 + 7 days  |
| 94 uruk-hai (1000)     |                                    | 1088, 895  | near Isengard           |          0 | event 4 + 7 days  |
| 95 Dunlendings (1500)  |                                    | 1088, 895  | near Isengard           |          0 | event 4 + 8 days  |
| 96 hand orcs (2000)    |                                    | 1088, 895  | near Isengard           |          0 | event 4 + 10 days |
| 97 Balchoth (2000)     |                                    | 2272, 576  | North Rhun              |          0 | event 7 + 0 days  |
| 98 Wainriders (2000)   |                                    | 2272, 576  | North Rhun              |          0 | event 7 + 5 days  |
| 99 Balchoth (1000)     |                                    | 2272, 576  | North Rhun              |          0 | event 7 + 13 days |
| 100 Easterlings (2000) |                                    | 1776, 992  | South Rhun              |          0 | event 7 + 2 days  |
| 101 Wainriders (2000)  |                                    | 1776, 992  | South Rhun              |          0 | event 7 + 7 days  |
| 102 Wainriders (1000)  |                                    | 1776, 992  | South Rhun              |          0 | event 7 + 10 days |
| 103 GOTHMOG            |                                    | 1664, 1168 | Minas Morgul            |          0 | event 7 + 2 days  |
| 104 orcs (2000)        |                                    | 1456, 676  | near Dol Guldur         |          0 | event 7 + 1 days  |
| 105 orcs (2000)        |                                    | 1456, 676  | near Dol Guldur         |          0 | event 7 + 3 days  |
| 106 orcs (1000)        |                                    | 1456, 676  | near Dol Guldur         |          0 | event 7 + 0 days  |
| 107 orcs (1000)        |                                    | 1456, 676  | near Dol Guldur         |          0 | event 7 + 7 days  |
| 108 orcs (2000)        |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 0 days  |
| 109 orcs (2000)        |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 1 days  |
| 110 trolls (250)       |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 2 days  |
| 111 orcs (2000)        |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 3 days  |
| 112 trolls (250)       |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 5 days  |
| 113 orcs (2000)        |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 6 days  |
| 114 orcs (2000)        |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 8 days  |
| 115 orcs (2000)        |                                    | 1744, 1008 | Morannon                |          0 | event 7 + 10 days |
| 116 orcs (2000)        |                                    | 1664, 1168 | Minas Morgul            |          0 | event 7 + 1 days  |
| 117 orcs (2000)        |                                    | 1664, 1168 | Minas Morgul            |          0 | event 7 + 2 days  |
| 118 trolls (250)       |                                    | 1664, 1168 | Minas Morgul            |          0 | event 7 + 3 days  |
| 119 orcs (2000)        |                                    | 1744, 1168 | Cirith Ungol            |          0 | event 7 + 3 days  |
| 120 orcs (2000)        |                                    | 1744, 1168 | Cirith Ungol            |          0 | event 7 + 4 days  |
| 121 trolls (500)       |                                    | 1760, 1072 | Carach Angren           |          0 | event 7 + 4 days  |
| 122 orcs (2000)        |                                    | 1760, 1072 | Carach Angren           |          0 | event 7 + 5 days  |
| 123 orcs (5000)        |                                    | 1856, 1120 | Barad-Dur               |          0 | event 7 + 6 days  |
| 124 trolls (500)       |                                    | 1856, 1120 | Barad-Dur               |          0 | event 7 + 8 days  |
| 125 orcs (2000)        |                                    | 1968, 1296 | Nurn                    |          0 | event 7 + 8 days  |
| 126 trolls (500)       |                                    | 1968, 1296 | Nurn                    |          0 | event 7 + 9 days  |
| 127 orcs (2000)        |                                    | 1968, 1296 | Nurn                    |          0 | event 7 + 10 days |
| 129 Southrons (2000)   |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 0 days  |
| 130 Southrons (2000)   |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 1 days  |
| 131 Haradrim (1000)    |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 2 days  |
| 132 Southrons (2000)   |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 4 days  |
| 133 Variags (1000)     |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 5 days  |
| 134 Haradrim (2000)    |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 7 days  |
| 135 halftrolls (1000)  |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 8 days  |
| 136 Southrons (2000)   |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 10 days |
| 137 Variags (2000)     |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 11 days |
| 138 Southrons (2000)   |                                    | 1584, 1504 | The Harad Road          |          0 | event 7 + 13 days |
| 139 Corsairs (2000)    |                                    | 1520, 1360 | near Pelargir           |          0 | event 7 + 5 days  |
| 150 SAURON             |                                    | 1856, 1120 | Barad-Dur               |          0 | event 7 + 0 days  |
| 151 Shelob             |                                    | 1744, 1166 | near Cirith Ungol       |          0 | Ring-bearer near  |
