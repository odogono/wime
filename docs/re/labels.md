# Labels

Names given to addresses in the Reference Build's executable during analysis ([address format](README.md#addresses)). A name is ours, not the original's: the executable has no symbols. Add to this list as functions and variables are identified.

## Code

| Address        | Label                | What it does                                                                             |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `code+0x00000` | `entry`              | `jmp code+0x1afb0`                                                                       |
| `code+0x00396` | `figureStep`         | works out the next tile for the watched Character's facing                               |
| `code+0x06b5c` | `pickUpObject`       | takes an object from the placement table into the object word                            |
| `code+0x06e9c` | `heal`               | sets health to maximum, "… feels much better."                                           |
| `code+0x070bc` | `palantirVision`     | "Looking deep into the crystal, … sees a vision:"; may set war event bit 7               |
| `code+0x08be0` | `saveGame`           | writes `data+0x1de8–0x3e71` to `A:ARCHIVE.DAT`                                           |
| `code+0x08d12` | `restoreGame`        | reads it back and restores the name pointers                                             |
| `code+0x0d26c` | `drawCampaignForces` | draws each awake leader's icon; blinks the player's                                      |
| `code+0x0d4c2` | `drawFullMapDots`    | one dot per awake leader at (x/4, y/8)                                                   |
| `code+0x0d718` | `blinkFullMapDots`   | loop that blinks the player's dots on the Full Map Level                                 |
| `code+0x0d894` | `hourlyUpdate`       | draws the date and, at hour 8, runs the daily checks                                     |
| `code+0x0da6c` | `councilOfElrond`    | Ring-bearer's Force and Gandalf at Rivendell; moves the calendar on                      |
| `code+0x0ddc4` | `ringAtMountDoom`    | Ring-bearer's Force at Mount Doom (0x710, 0x460) calls `data+0x0036`, presumably the win |
| `code+0x0ddec` | `copyProtection`     | "The Valar seek to determine your fitness …" from day 92                                 |
| `code+0x0e0c0` | `warEvents`          | sets event mask bits 1–7                                                                 |
| `code+0x0e306` | `tileAt`             | map grid byte under (x, y)                                                               |
| `code+0x0e342` | `placeAt`            | Place 1–84 at (x, y), or 0                                                               |
| `code+0x0e3f4` | `terrainAt`          | `data+0x4242[tileAt(x, y)]`                                                              |
| `code+0x0e420` | `nextRouteStop`      | pops the next Default Orders Place into the destination                                  |
| `code+0x0e4e4` | `tryTrigger`         | tests an entry's trigger byte                                                            |
| `code+0x0e6a8` | `trigger`            | wakes and mobilises an entry                                                             |
| `code+0x0e712` | `tick`               | moves one roster entry; advances the clock after entry 151                               |
| `code+0x0e916` | `moveEntry`          | one movement step: facing, speed, terrain, stamina                                       |
| `code+0x0f04e` | `findEncounter`      | looks for an Encounter among entries 152–195 or nearby Forces                            |
| `code+0x1afb0` | `start`              | C runtime start: clears BSS, opens libraries                                             |
| `code+0x1b022` | `setA4`              | `lea data+0x7ffe, a4`                                                                    |
| `code+0x1bb76` | `mulu32`             | 32-bit multiply, reached through `data+0x0252`; index × 38 for roster records            |

## Data

| Address       | Label                  | Contents                                        |
| ------------- | ---------------------- | ----------------------------------------------- |
| `data+0x0000` | `jumpTable`            | 100 × `jmp abs.l`                               |
| `data+0x0252` | `jt_mulu32`            | jump table entry for `mulu32`                   |
| `data+0x08c2` | `clockLimit`           | frame count a clock step waits for              |
| `data+0x08cc` | `watched`              | roster entry being watched                      |
| `data+0x1d32` | `healthWords`          | pointers: "near death" … "hale and hardy"       |
| `data+0x1d46` | `directionNames`       | pointers: "north" … "northwest"                 |
| `data+0x1d66` | `monthNames`           | pointers: "September " … "April "               |
| `data+0x1d86` | `yearNames`            | ", 1418 s.r.", ", 1419 s.r."                    |
| `data+0x1da0` | `amPm`                 | " a.m. ", " p.m. "                              |
| `data+0x1de8` | `roster`               | 196 × 38-byte records                           |
| `data+0x3b00` | `routes`               | 86 × 8 Place numbers                            |
| `data+0x3db0` | `objectPlacements`     | 30 × 6                                          |
| `data+0x3e64` | `day`                  | word                                            |
| `data+0x3e66` | `quarterHour`          | word, 0–95                                      |
| `data+0x3e69` | `eventMask`            | byte                                            |
| `data+0x3e6a` | `ringBearer`           | byte; also base of `eventDay[bit]`              |
| `data+0x3e72` | `places`               | 85 × 10                                         |
| `data+0x41c4` | `speedTable`           | 2 × 6 words                                     |
| `data+0x41fc` | `facingDx`             | 8 words                                         |
| `data+0x420c` | `facingDy`             | 8 words                                         |
| `data+0x422f` | `passedCopyProtection` | byte                                            |
| `data+0x4230` | `monthStart`           | 8 words                                         |
| `data+0x4242` | `terrainByTile`        | 256 bytes                                       |
| `data+0x4342` | `objects`              | 17 × 8                                          |
| `data+0x4f40` | `blinkPhase`           | toggles each frame                              |
| `data+0x4fec` | `frameCounter`         | compared with `data+0x08c2` before a clock step |
| `data+0x5020` | `iconSheet`            | Campaign icon bitmap                            |
| `data+0x5555` | `mode`                 | 1, 2 or 3; probably the current Level           |
| `data+0x56b3` | `tickEntry`            | roster entry the tick is on, 1–151              |
