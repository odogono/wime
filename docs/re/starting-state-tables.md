# Starting-state tables

The starting state is the initialised data hunk as loaded: no code builds it at startup. A saved game is a copy of `data+0x1de8` to `data+0x3e71` (finding:data-formats-archive-dat-is-roster-dump). All offsets are data hunk offsets ([README](README.md)); multi-byte values are big-endian.

| Range           | Table                                                                  | Records     |
| --------------- | ---------------------------------------------------------------------- | ----------- |
| `0x0000–0x0257` | jump table, `jmp abs.l` × 100                                          | 6 bytes     |
| `0x1d0e–0x1d85` | text pointers: list joiners, ratings, health words, directions, months | 4 bytes     |
| `0x1d86–0x1daf` | year and a.m./p.m. strings                                             | text        |
| `0x1de8–0x3aff` | roster                                                                 | 196 × 38    |
| `0x3b00–0x3daf` | Default Orders routes                                                  | 86 × 8      |
| `0x3db0–0x3e63` | objects lying on the map                                               | 30 × 6      |
| `0x3e64–0x3e71` | clock and event state                                                  | see below   |
| `0x3e72–0x412d` | named Places 0–69 (0 is empty)                                         | 70 × 10     |
| `0x412e–0x41c3` | generic Place kinds 70–84                                              | 15 × 10     |
| `0x41c4–0x41db` | speed table                                                            | 2 × 6 words |
| `0x41dc–0x41fb` | one-pixel movement steps by facing, dx then dy                         | 2 × 8 words |
| `0x41fc–0x421b` | facing steps, dx then dy                                               | 2 × 8 words |
| `0x421c–0x4226` | desired facing by sign toward destination (indexed from `0x421d`)      | 11 bytes    |
| `0x4227–0x422e` | steering weights by angular distance from the desired facing           | 8 bytes     |
| `0x4230–0x423f` | first day of each month                                                | 8 words     |
| `0x4242–0x4341` | per-tile terrain value, indexed by tile                                | 256 bytes   |
| `0x4342–0x43c9` | objects                                                                | 17 × 8      |

## Roster record (38 bytes, `0x1de8 + 38 × index`)

Entry 0 is empty. Entries 1–151 are moved by the main loop; entries 152–195 are Encounter figures that never move. The table reuses some fields for those, marked "152+". Addresses are code that reads or writes the field.

| Off | Size | Field             | Notes                                                                         | Code                     |
| --- | ---- | ----------------- | ----------------------------------------------------------------------------- | ------------------------ |
| 0   | 4    | name              | pointer into the code hunk                                                    | `0x08be0` (save/restore) |
| 4   | 2    | starting strength | 1 for a Character; Unit if > 1                                                | `0x04d5c`                |
| 6   | 2    | strength          | current; 0 is dead or destroyed                                               | `0x0e89e`, `0x0f6d2`     |
| 8   | 2    | x                 | Campaign pixels. 152+: area left                                              | `0x0d536`, `0x0f128`     |
| 10  | 2    | y                 | 152+: area top                                                                | `0x0d528`, `0x0f154`     |
| 12  | 2    | destination x     | 0 = none. 152+: area right                                                    | `0x0e452`, `0x0f13e`     |
| 14  | 2    | destination y     | 152+: area bottom                                                             | `0x0e46c`, `0x0f16a`     |
| 16  | 2    | objects           | bit n = object n                                                              | `0x06cda`, `0x06e26`     |
| 18  | 1    | Campaign icon     | sheet cell: column = low nibble, row = high nibble                            | `0x0d2e0`                |
| 19  | 1    | ?                 | never read directly                                                           |                          |
| 20  | 1    | Animation figure  | 4 = Wizard, 0x0c = Balrog, > 0x14 = Elrond/Galadriel/Tom                      | `0x09f76`, `0x0850c`     |
| 21  | 1    | facing            | 0–7 clockwise from north                                                      | `0x0eba6`, `0x003b4`     |
| 22  | 1    | state             | 0 asleep, 1 moving, 2 skipped, 3 resting                                      | `0x0e868`, `0x0e8aa`     |
| 23  | 1    | fighting strength | raised by one event at `0x06f96`                                              | `0x0f1c4`                |
| 24  | 1    | ?                 | 3 for the most powerful figures                                               |                          |
| 25  | 1    | maximum health    |                                                                               | `0x06ed4`                |
| 26  | 2    | health            | current                                                                       | `0x06ebc`, `0x0e6b6`     |
| 28  | 1    | allegiance        | 0 Evil, 1 unmobilised, 99 mobilised; see finding:mobilisation-allegiance-byte | `0x0d4f6`, `0x0e6d4`     |
| 29  | 1    | ?                 | 152+: Encounter chance out of 100                                             | `0x0f1b6`                |
| 30  | 1    | trigger           | highest set bit picks the condition; see finding:ai-trigger-conditions        | `0x0e4f8`, `0x0e82e`     |
| 31  | 1    | speed class       | 0–5, index into the speed table                                               | `0x0ebce`                |
| 32  | 1    | pixel fraction    | 256ths moved. 152+: first day it can be met                                   | `0x0ec7a`, `0x0f18c`     |
| 33  | 1    | maximum stamina   | 255 = never tires                                                             | `0x0ec56`                |
| 34  | 1    | stamina           | current                                                                       | `0x0ec66`, `0x0e8c8`     |
| 35  | 1    | leader            | roster index; 0 = leads its own Force                                         | `0x0da36`, `0x0d4e2`     |
| 36  | 1    | route             | row of the route table                                                        | `0x0e42a`                |
| 37  | 1    | ?                 | always 0                                                                      |                          |

## Route row (8 bytes, `0x3b00 + 8 × route`)

Up to eight Place numbers, ended by 0. Taking the next destination copies Place `row[0]`'s position into the record's destination and shifts the row left (`code+0x0e420`). Rows 1–85 belong to entries; 77 are non-empty at the start.

## Object placement (6 bytes, `0x3db0 + 6 × slot`)

| Off | Size | Field                                       |
| --- | ---- | ------------------------------------------- |
| 0   | 1    | object number; 99 = empty                   |
| 1   | 1    | 0                                           |
| 2   | 2    | x; set to 0 when picked up (`code+0x06c0a`) |
| 4   | 2    | y                                           |

## Clock and event state (`0x3e64–0x3e71`)

| Offset   | Size | Field                                                  | Start |
| -------- | ---- | ------------------------------------------------------ | ----- |
| `0x3e64` | 2    | day count, 0 = 23 September 1418                       | 0     |
| `0x3e66` | 2    | quarter-hour of the day, 0–95                          | 64    |
| `0x3e68` | 1    | ? (set to 1 at the start, not traced)                  | 1     |
| `0x3e69` | 1    | event mask                                             | 0x05  |
| `0x3e6a` | 1    | Ring-bearer, as a roster index                         | 7     |
| `0x3e6b` | 7    | day each event bit 1–7 was set, indexed `0x3e6a + bit` | 0     |

## Place record (10 bytes, `0x3e72 + 10 × index`)

| Off | Size | Named Places 1–69                                                               | Kinds 70–84       |
| --- | ---- | ------------------------------------------------------------------------------- | ----------------- |
| 0   | 4    | name pointer                                                                    | kind name pointer |
| 4   | 2    | x                                                                               | 0                 |
| 6   | 2    | y                                                                               | tile number       |
| 8   | 1    | grid byte: column `'A' + (b >> 1 & 7)`, row `b >> 4`, bit 0 = attacks announced | 0                 |
| 9   | 1    | 0                                                                               | 0                 |

The Place at a point is found by `code+0x0e342`: the point is rounded down to its tile, then compared with the positions of Places 1–69, then with the tile numbers of 70–84.

## Object record (8 bytes, `0x4342 + 8 × index`)

A name pointer, then byte 4 (50–65, not traced, probably the picture), byte 5 the kind of use, byte 6 usable and byte 7 used up (finding:objects-use-table). Entries 0–15 are the objects whose bits make up the roster's object word; entry 16 is "other useful objects".

## Speed table (`0x41c4`)

Two rows of six words, in 256ths of a pixel per step: straight `0, 336, 372, 414, 460, 512`, then diagonal `0, 238, 262, 292, 326, 362`. Movement picks the row by bit 0 of the facing (`code+0x0ebb6`).
