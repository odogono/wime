# Starting positions of every Force and Character

A complete index of the Amiga v1.0 Reference Build's starting roster, before the
first movement step: day 0, 23 September 1418 S.R., at the opening time displayed
as 5 p.m. It covers all 195 roster entries: 151 Characters and Units grouped into
123 Forces, followed by 44 Encounter figures.

## Reading the tables

- Each Force row gives its Leader and every follower. The number before a name
  is its roster ID, so identically named Units remain distinguishable. Numbers
  in parentheses are a Unit's starting strength; an individual Character has
  strength 1. Names retain the source spelling.
- Followers share their top Leader's position. Their stored `(0, 0)` means no
  independent position; it does not put them in the corner of the map.
- Coordinates are **Campaign Level pixels**, measured from the top left:
  x increases eastwards and y southwards. The map is 2,560 by 1,584 pixels;
  a tile is 16 by 16 pixels. Exact coordinates are retained, including offsets
  of a single pixel from a named Place.
- The “Location” descriptions reproduce the reviewed starting-state Spec's
  geographic labels. “Near” is a descriptive landmark, not a movement target,
  detection radius or claim that the Force occupies that Place's tile.
- “Awake” means the Force's Leader is visible on the map. It does not mean the
  player can command it, or that it is already travelling. Sleeping Forces have
  starting positions but are not drawn. Followers inherit their Force's map
  visibility in these tables.
- `GANDALF'` (entry 2) is the second Gandalf entry, initially sleeping at Lórien.
  It is listed separately from entry 1 at Rivendell.

Sources: [starting-state Spec](spec/starting-state.md),
[roster order](findings/forces-roster-order.md),
[Force membership](findings/forces-leader-byte-forms-forces.md),
[initial visibility](findings/forces-starting-forces-on-the-map.md), and
[map coordinates](findings/map-positions-are-campaign-pixels.md).
For when these Forces wake and how they choose destinations, see
[How the game AI works](game-ai.md).

## Awake Forces (42)

| Leader                  | Followers                                  | Starting x, y | Location           |
| ----------------------- | ------------------------------------------ | ------------- | ------------------ |
| 7 FRODO                 | 8 SAM; 10 PIPPIN                           | 640, 368      | Hobbiton           |
| 13 EOMER                | 14 cavalry (120)                           | 1360, 960     | East Emnet         |
| 15 FARAMIR              | 16 Rangers (200)                           | 1632, 1104    | North Ithilien     |
| 17 DAIN                 | 18 dwarves (1,000)                         | 1744, 224     | Erebor             |
| 19 BRAND                | 20 infantry (400); 21 lt. infantry (600)   | 1744, 256     | Dale               |
| 22 THRANDUIL            | 23 elves (800)                             | 1696, 240     | Thranduil's Palace |
| 26 THEODEN              | 27 cavalry (960)                           | 1248, 992     | Edoras             |
| 28 THEODRED             | 29 cavalry (120)                           | 1104, 928     | Isen Ford          |
| 30 ERKENBRAND           | 31 cavalry (1,200)                         | 1168, 960     | Hornburg           |
| 32 DENETHOR             | 33 tower guards (100); 34 infantry (1,500) | 1616, 1184    | Minas Tirith       |
| 42 IMRAHIL              | 43 knights (500); 44 men at arms (700)     | 1168, 1296    | Dol Amroth         |
| 58 dwarves (500)        | —                                          | 1984, 256     | Iron Hills         |
| 67 lt. infantry (1,000) | —                                          | 1248, 992     | Edoras             |
| 68 lt. infantry (1,000) | —                                          | 1168, 960     | Hornburg           |
| 69 infantry (100)       | —                                          | 1624, 1184    | Rammas Forts       |
| 70 infantry (400)       | —                                          | 1632, 1184    | Osgiliath          |
| 71 infantry (100)       | —                                          | 1600, 1136    | Cair Andros        |
| 74 infantry (500)       | —                                          | 1360, 1312    | Linhir             |
| 76 infantry (200)       | —                                          | 1552, 1328    | Pelargir           |
| 79 the NAZGUL LORD      | —                                          | 608, 464      | near Waymeet       |
| 80 the 2nd NAZGUL       | —                                          | 624, 432      | near Waymeet       |
| 81 the 3rd NAZGUL       | —                                          | 640, 360      | near Hobbiton      |
| 82 the 4th NAZGUL       | —                                          | 640, 400      | Tuckborough        |
| 83 the 5th NAZGUL       | —                                          | 752, 512      | near Sarn Ford     |
| 84 the 6th NAZGUL       | —                                          | 736, 496      | near Sarn Ford     |
| 85 the 7th NAZGUL       | —                                          | 736, 480      | near Sarn Ford     |
| 86 the 8th NAZGUL       | —                                          | 752, 496      | near Sarn Ford     |
| 87 the 9th NAZGUL       | —                                          | 736, 512      | near Sarn Ford     |
| 90 hand orcs (2,500)    | —                                          | 1088, 896     | Isengard           |
| 91 uruk-hai (1,500)     | —                                          | 1088, 896     | Isengard           |
| 92 Dunlendings (2,000)  | —                                          | 1088, 896     | Isengard           |
| 128 orcs (5,000)        | —                                          | 1808, 1120    | Mt. Doom           |
| 140 orcs (500)          | —                                          | 1280, 144     | Mt. Gundabad       |
| 141 orcs (500)          | —                                          | 1312, 336     | Goblin Town        |
| 142 orcs (500)          | —                                          | 1216, 592     | Dimrill Dale       |
| 143 orcs (1,000)        | —                                          | 1456, 672     | Dol Guldur         |
| 144 orcs (10,000)       | —                                          | 1744, 1008    | Morannon           |
| 145 orcs (3,400)        | —                                          | 1760, 1072    | Carach Angren      |
| 146 orcs (10,000)       | —                                          | 1664, 1168    | Minas Morgul       |
| 147 orcs (2,500)        | —                                          | 1744, 1168    | Cirith Ungol       |
| 148 orcs (9,500)        | —                                          | 1856, 1120    | Barad-Dur          |
| 149 trolls (500)        | —                                          | 1856, 1120    | Barad-Dur          |

## Sleeping Forces (81)

| Leader                  | Followers                                | Starting x, y | Location                |
| ----------------------- | ---------------------------------------- | ------------- | ----------------------- |
| 1 GANDALF               | 6 BOROMIR; 11 LEGOLAS; 12 GIMLI          | 1216, 380     | near Rivendell          |
| 2 GANDALF'              | —                                        | 1344, 656     | Lorien                  |
| 3 ELROND                | —                                        | 1208, 392     | near Ford Of Bruinen    |
| 4 GLORFINDEL            | —                                        | 1104, 396     | near The Last Bridge    |
| 5 ARAGORN               | —                                        | 784, 380      | near Bree               |
| 9 MERRY                 | —                                        | 704, 414      | near Buckland           |
| 24 CELEBORN             | 25 elves (800)                           | 1344, 655     | near Lorien             |
| 35 DERNHELM             | —                                        | 1248, 992     | Edoras                  |
| 36 ELFHELM              | 37 cavalry (2,300)                       | 1248, 992     | Edoras                  |
| 38 GRIMBOLD             | 39 cavalry (2,300)                       | 1248, 992     | Edoras                  |
| 40 DUNHERE              | 41 cavalry (2,300)                       | 1248, 992     | Edoras                  |
| 45 FORLONG              | 46 men at arms (200)                     | 1600, 1200    | Lossarnach              |
| 47 DERVORIN             | 48 infantry (300)                        | 1344, 1200    | Ethring                 |
| 49 DUINHIR              | 50 infantry (500)                        | 1232, 1136    | Erech                   |
| 51 GOLASGIL             | 52 infantry (100); 53 lt. infantry (400) | 896, 1264     | Anfalas                 |
| 54 HIRLUIN              | 55 infantry (300)                        | 944, 1200     | Pinnath Gelin           |
| 56 elven guards (60)    | —                                        | 1216, 380     | near Rivendell          |
| 57 Rangers (20)         | —                                        | 1056, 912     | near Isengard           |
| 59 elves (500)          | —                                        | 1344, 656     | Lorien                  |
| 60 elves (1,000)        | —                                        | 1344, 655     | near Lorien             |
| 61 elves (1,000)        | —                                        | 1344, 655     | near Lorien             |
| 62 elves (1,000)        | —                                        | 1696, 239     | near Thranduil's Palace |
| 63 elves (500)          | —                                        | 1696, 239     | near Thranduil's Palace |
| 64 elves (500)          | —                                        | 1696, 239     | near Thranduil's Palace |
| 65 ents (1,000)         | —                                        | 1168, 848     | Derndingle              |
| 66 huorns (1,000)       | —                                        | 1168, 848     | Derndingle              |
| 72 infantry (800)       | —                                        | 1344, 1199    | near Ethring            |
| 73 infantry (1,000)     | —                                        | 1296, 1167    | near Calembel           |
| 75 infantry (2,000)     | —                                        | 1360, 1311    | near Linhir             |
| 77 infantry (800)       | —                                        | 1552, 1327    | near Pelargir           |
| 78 GOLLUM               | —                                        | 1168, 592     | Hollin Gate             |
| 88 hand orcs (150)      | —                                        | 1088, 896     | Isengard                |
| 89 hand orcs (150)      | —                                        | 1088, 896     | Isengard                |
| 93 hand orcs (2,000)    | —                                        | 1088, 895     | near Isengard           |
| 94 uruk-hai (1,000)     | —                                        | 1088, 895     | near Isengard           |
| 95 Dunlendings (1,500)  | —                                        | 1088, 895     | near Isengard           |
| 96 hand orcs (2,000)    | —                                        | 1088, 895     | near Isengard           |
| 97 Balchoth (2,000)     | —                                        | 2272, 576     | North Rhun              |
| 98 Wainriders (2,000)   | —                                        | 2272, 576     | North Rhun              |
| 99 Balchoth (1,000)     | —                                        | 2272, 576     | North Rhun              |
| 100 Easterlings (2,000) | —                                        | 1776, 992     | South Rhun              |
| 101 Wainriders (2,000)  | —                                        | 1776, 992     | South Rhun              |
| 102 Wainriders (1,000)  | —                                        | 1776, 992     | South Rhun              |
| 103 GOTHMOG             | —                                        | 1664, 1168    | Minas Morgul            |
| 104 orcs (2,000)        | —                                        | 1456, 676     | near Dol Guldur         |
| 105 orcs (2,000)        | —                                        | 1456, 676     | near Dol Guldur         |
| 106 orcs (1,000)        | —                                        | 1456, 676     | near Dol Guldur         |
| 107 orcs (1,000)        | —                                        | 1456, 676     | near Dol Guldur         |
| 108 orcs (2,000)        | —                                        | 1744, 1008    | Morannon                |
| 109 orcs (2,000)        | —                                        | 1744, 1008    | Morannon                |
| 110 trolls (250)        | —                                        | 1744, 1008    | Morannon                |
| 111 orcs (2,000)        | —                                        | 1744, 1008    | Morannon                |
| 112 trolls (250)        | —                                        | 1744, 1008    | Morannon                |
| 113 orcs (2,000)        | —                                        | 1744, 1008    | Morannon                |
| 114 orcs (2,000)        | —                                        | 1744, 1008    | Morannon                |
| 115 orcs (2,000)        | —                                        | 1744, 1008    | Morannon                |
| 116 orcs (2,000)        | —                                        | 1664, 1168    | Minas Morgul            |
| 117 orcs (2,000)        | —                                        | 1664, 1168    | Minas Morgul            |
| 118 trolls (250)        | —                                        | 1664, 1168    | Minas Morgul            |
| 119 orcs (2,000)        | —                                        | 1744, 1168    | Cirith Ungol            |
| 120 orcs (2,000)        | —                                        | 1744, 1168    | Cirith Ungol            |
| 121 trolls (500)        | —                                        | 1760, 1072    | Carach Angren           |
| 122 orcs (2,000)        | —                                        | 1760, 1072    | Carach Angren           |
| 123 orcs (5,000)        | —                                        | 1856, 1120    | Barad-Dur               |
| 124 trolls (500)        | —                                        | 1856, 1120    | Barad-Dur               |
| 125 orcs (2,000)        | —                                        | 1968, 1296    | Nurn                    |
| 126 trolls (500)        | —                                        | 1968, 1296    | Nurn                    |
| 127 orcs (2,000)        | —                                        | 1968, 1296    | Nurn                    |
| 129 Southrons (2,000)   | —                                        | 1584, 1504    | The Harad Road          |
| 130 Southrons (2,000)   | —                                        | 1584, 1504    | The Harad Road          |
| 131 Haradrim (1,000)    | —                                        | 1584, 1504    | The Harad Road          |
| 132 Southrons (2,000)   | —                                        | 1584, 1504    | The Harad Road          |
| 133 Variags (1,000)     | —                                        | 1584, 1504    | The Harad Road          |
| 134 Haradrim (2,000)    | —                                        | 1584, 1504    | The Harad Road          |
| 135 halftrolls (1,000)  | —                                        | 1584, 1504    | The Harad Road          |
| 136 Southrons (2,000)   | —                                        | 1584, 1504    | The Harad Road          |
| 137 Variags (2,000)     | —                                        | 1584, 1504    | The Harad Road          |
| 138 Southrons (2,000)   | —                                        | 1584, 1504    | The Harad Road          |
| 139 Corsairs (2,000)    | —                                        | 1520, 1360    | near Pelargir           |
| 150 SAURON              | —                                        | 1856, 1120    | Barad-Dur               |
| 151 Shelob              | —                                        | 1744, 1166    | near Cirith Ungol       |

## Encounter figures (44)

These entries do not lead moving map Forces. Their coordinate fields define
where they can be met, not a starting position from which they travel. A fixed
spot has identical bounds; otherwise the table gives the stored rectangle's
top-left and bottom-right corners. The bounds are reproduced without clipping
them to the map dimensions. They describe eligibility areas, not guaranteed
appearances: encounters have additional chance and eligibility rules.

For a fixed spot, the description names a Place only on an exact coordinate
match. Treebeard's spot is 96 pixels east of Derndingle. Wider rectangles are
labelled “Area” so their coordinates are not mistaken for a single position.

Source: [Encounter figures wait in areas](findings/forces-encounter-figures-wait-in-areas.md).
The [Encounter Spec](spec/encounters.md) describes how a passing Force meets them.

| ID  | Figure          | Location type             | Top-left x, y | Bottom-right x, y |
| --- | --------------- | ------------------------- | ------------- | ----------------- |
| 152 | CIRDAN          | Fixed: GREY HAVENS        | 416, 400      | 416, 400          |
| 153 | TOM BOMBADIL    | Fixed: BOMBADIL'S HOUSE   | 752, 416      | 752, 416          |
| 154 | BILBO           | Fixed: RIVENDELL          | 1216, 384     | 1216, 384         |
| 155 | GALADRIEL       | Fixed: LORIEN             | 1344, 656     | 1344, 656         |
| 156 | TREEBEARD       | Fixed: east of Derndingle | 1264, 848     | 1264, 848         |
| 157 | RADAGAST        | Area                      | 418, 144      | 1200, 512         |
| 158 | a Ranger        | Area                      | 418, 144      | 1168, 592         |
| 159 | Rohirrim scouts | Area                      | 1120, 896     | 1424, 1040        |
| 160 | a dwarf         | Area                      | 720, 496      | 1552, 1328        |
| 161 | a hobbit        | Area                      | 418, 144      | 1168, 592         |
| 162 | an elf          | Area                      | 418, 144      | 1168, 592         |
| 163 | a wanderer      | Area                      | 418, 144      | 1168, 592         |
| 164 | a traveler      | Area                      | 418, 144      | 1168, 592         |
| 165 | an old man      | Area                      | 418, 144      | 1168, 592         |
| 166 | SARUMAN         | Fixed: ISENGARD           | 1088, 896     | 1088, 896         |
| 167 | orcs            | Area                      | 1120, 64      | 1440, 224         |
| 168 | orcs            | Area                      | 1248, 248     | 1392, 480         |
| 169 | orcs            | Area                      | 1120, 528     | 1248, 656         |
| 170 | orcs            | Area                      | 1392, 528     | 1616, 736         |
| 171 | orcs            | Area                      | 840, 800      | 1520, 976         |
| 172 | orcs            | Area                      | 1632, 928     | 2400, 1488        |
| 173 | trolls          | Area                      | 1072, 320     | 1200, 448         |
| 174 | trolls          | Area                      | 1424, 592     | 1536, 704         |
| 175 | a troll         | Area                      | 1184, 576     | 1216, 592         |
| 176 | a troll         | Area                      | 1648, 1008    | 2240, 1408        |
| 177 | a wight         | Area                      | 752, 400      | 784, 448          |
| 178 | Dead Men        | Area                      | 1216, 1056    | 1248, 1088        |
| 179 | Dunlendings     | Area                      | 896, 656      | 1088, 912         |
| 180 | Southrons       | Area                      | 1344, 1200    | 2560, 1600        |
| 181 | bandits         | Area                      | 1440, 144     | 1728, 736         |
| 182 | orcs            | Area                      | 1680, 1024    | 1936, 1248        |
| 183 | a balrog        | Area                      | 1264, 112     | 1312, 192         |
| 184 | a balrog        | Area                      | 1168, 576     | 1216, 592         |
| 185 | a balrog        | Area                      | 1056, 640     | 1168, 816         |
| 186 | a balrog        | Area                      | 1664, 1040    | 2544, 1200        |
| 187 | a balrog        | Area                      | 1696, 1200    | 1760, 1488        |
| 188 | wolves          | Area                      | 976, 0        | 1696, 112         |
| 189 | wolves          | Area                      | 896, 608      | 1008, 944         |
| 190 | wolves          | Area                      | 1008, 160     | 1200, 912         |
| 191 | wolves          | Area                      | 1312, 720     | 2400, 1072        |
| 192 | spiders         | Area                      | 1472, 192     | 1664, 704         |
| 193 | a spider        | Area                      | 1248, 160     | 1360, 448         |
| 194 | spiders         | Area                      | 1680, 1040    | 1776, 1472        |
| 195 | a spider        | Area                      | 1680, 1088    | 1760, 1248        |

## Provenance and maintenance

This is a documentation summary of the starting-state tables, not a second
source of simulation data. Force positions and geographic descriptions can be
cross-checked against the [starting-state Spec](spec/starting-state.md).
Membership, roster IDs and Encounter bounds were checked against the local
`web/public/assets/starting-state.json` produced by `bun run export:web`.
The exported file and original game assets remain gitignored.

The extractor is [tools/extract-starting-state.ts](../tools/extract-starting-state.ts);
the underlying layouts are documented in
[starting-state-tables.md](re/starting-state-tables.md). If the interpretation of
those tables changes, update this index alongside the starting-state Spec and
check that IDs 1–151 appear exactly once among Leaders and followers, and IDs
152–195 exactly once in the Encounter table.
