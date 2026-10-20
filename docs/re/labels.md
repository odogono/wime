# Labels

Names given to addresses in the Reference Build's executable during analysis ([address format](README.md#addresses)). A name is ours, not the original's: the executable has no symbols. Add to this list as functions and variables are identified.

## Code

| Address        | Label                | What it does                                                                             |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `code+0x00000` | `entry`              | `jmp code+0x1afb0`                                                                       |
| `code+0x00006` | `buildScene`         | composes the Animation Level scene bitmap from scenery layers                            |
| `code+0x00396` | `figureStep`         | works out the next tile for the watched Character's facing                               |
| `code+0x00d3c` | `placeScenery`       | the scenery of particular Places, by tile byte                                           |
| `code+0x0296c` | `loseGame`           | 1: the Ring at Barad-dûr (CSTR 49); 2: three Strongholds lost (CSTR 50)                  |
| `code+0x02e64` | `winGame`            | victory ending, BScene CSTR 53–55                                                        |
| `code+0x031c2` | `randomBits`         | (seed × 125 + data+0x4fee) mod 0x2aaaab, low n bits                                      |
| `code+0x0320c` | `random`             | seed × 125 mod 0x2aaaab, then mod n                                                      |
| `code+0x03240` | `absWord`            | absolute value of a word                                                                 |
| `code+0x037d8` | `newFigure`          | creates a figure object from an FRML set and script entry                                |
| `code+0x039a6` | `newPicture`         | creates a still IMAG object                                                              |
| `code+0x04528` | `describeEntry`      | one status row: "is going to", "heading", "following", "at", "resting."                  |
| `code+0x04bea` | `listFollowers`      | adds a Leader's followers as combat rows, merging like names                             |
| `code+0x04dde` | `listForcesNear`     | Good and Evil lists near (x, y); (0, 0) lists every moving Leader                        |
| `code+0x05be2` | `openMessageBox`     | waits for the open box to expire, then opens a new one                                   |
| `code+0x06172` | `showMessageBox`     | shows the box; with a button pair, sets the default and its deadline                     |
| `code+0x06b5c` | `pickUpObject`       | takes an object from the placement table into the object word                            |
| `code+0x06d8e` | `putDownObject`      | writes an object into the first free placement slot                                      |
| `code+0x06e60` | `useObject`          | switches on the object record's kind of use                                              |
| `code+0x06e9c` | `heal`               | sets health to maximum, "… feels much better."                                           |
| `code+0x070bc` | `palantirVision`     | "Looking deep into the crystal, … sees a vision:"; may set war event bit 7               |
| `code+0x07dc4` | `galadrielsMirror`   | the Full Map eye: "In the still surface of the pool…"                                    |
| `code+0x07eb0` | `archiveWindow`      | "Would you like to..." restore or save                                                   |
| `code+0x08616` | `putDownList`        | "Select the object for … to drop:"                                                       |
| `code+0x087d6` | `takeList`           | "Select the object for … to get:"                                                        |
| `code+0x089d6` | `useList`            | "Select the object for … to use:"                                                        |
| `code+0x08be0` | `saveGame`           | writes `data+0x1de8–0x3e71` to `A:ARCHIVE.DAT`                                           |
| `code+0x08d12` | `restoreGame`        | reads it back and restores the name pointers                                             |
| `code+0x09e02` | `enterAnimation`     | sets mode 3 and places the eye, map and sack icons                                       |
| `code+0x09e92` | `leaveAnimation`     | removes the icons and scene, frees FRML 4, 8, 16 and 18                                  |
| `code+0x09ffa` | `spawnFigures`       | adds a roster entry's figures to the scene                                               |
| `code+0x0b102` | `animationLoop`      | the Animation Level loop                                                                 |
| `code+0x0b7de` | `adviceTip`          | one of BScene CSTR 8–27 not yet given                                                    |
| `code+0x0bf84` | `runFigureScript`    | steps a figure's animation script                                                        |
| `code+0x0d26c` | `drawCampaignForces` | draws each awake leader's icon; blinks the player's                                      |
| `code+0x0d452` | `drawFullMap`        | blits AMaps IMAG 2, then the dots                                                        |
| `code+0x0d4c2` | `drawFullMapDots`    | one dot per awake leader at (x/4, y/8)                                                   |
| `code+0x0d5d4` | `enterFullMap`       | places the Full Map icons and loads its palette                                          |
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
| `code+0x0f382` | `evasionRoll`        | averages byte 29 over the Good Force; random(100) below it evades                        |
| `code+0x1003c` | `combatWait`         | redraws and handles option clicks until data+0x4fee reaches a deadline                   |
| `code+0x101f2` | `drawRowOptions`     | a Good row's four option buttons                                                         |
| `code+0x102bc` | `drawCombatRow`      | a row's head count and name, in its health colour                                        |
| `code+0x104fe` | `clearCombatMessage` | clears the combat window's message line                                                  |
| `code+0x105c6` | `combatClick`        | sets a Good row's option from a click                                                    |
| `code+0x109c2` | `combat`             | fights a battle to the end: window, rounds, aftermath                                    |
| `code+0x1268e` | `combatOver`         | tests the side totals after a round                                                      |
| `code+0x1286e` | `applyCombatLosses`  | takes each row's losses from its entries                                                 |
| `code+0x12d9c` | `reassignFollowers`  | followers of dead Leaders                                                                |
| `code+0x13098` | `passTheRing`        | hands a dropped Ring to the winners                                                      |
| `code+0x134cc` | `checkStrongholds`   | three dead Garrisons lose; entry 148 dead wins                                           |
| `code+0x1afb0` | `start`              | C runtime start: clears BSS, opens libraries                                             |
| `code+0x1b022` | `setA4`              | `lea data+0x7ffe, a4`                                                                    |
| `code+0x1b48a` | `udiv32`             | d0 / d1, unsigned                                                                        |
| `code+0x1bb76` | `mulu32`             | 32-bit multiply, reached through `data+0x0252`; index × 38 for roster records            |

## Data

| Address       | Label                  | Contents                                                                |
| ------------- | ---------------------- | ----------------------------------------------------------------------- |
| `data+0x0000` | `jumpTable`            | 100 × `jmp abs.l`                                                       |
| `data+0x0030` | `jt_loseGame`          | jump table entry for `loseGame`                                         |
| `data+0x0036` | `jt_winGame`           | jump table entry for `winGame`                                          |
| `data+0x0252` | `jt_mulu32`            | jump table entry for `mulu32`                                           |
| `data+0x0258` | `sceneWords`           | 256 words: the scene word for each tile byte                            |
| `data+0x06b0` | `sceneryLists`         | 18 pointers to lists of scenery layer groups                            |
| `data+0x085a` | `foregroundLists`      | foreground pieces (BScene IMAG 300–317) for each scenery list           |
| `data+0x08ac` | `skyColours`           | 12 sky colour indices by quarter-hour ÷ 8                               |
| `data+0x08c2` | `clockLimit`           | frame count a clock step waits for                                      |
| `data+0x08c4` | `rngSeed`              | longword                                                                |
| `data+0x08cc` | `watched`              | roster entry being watched                                              |
| `data+0x08d0` | `ringWorn`             | byte; the Ring-bearer has put on the Ring this fight                    |
| `data+0x095e` | `figureScripts`        | 20 scripts of 0xfc bytes, one per FRML set                              |
| `data+0x1d32` | `healthWords`          | pointers: "near death" … "hale and hardy"                               |
| `data+0x1d46` | `directionNames`       | pointers: "north" … "northwest"                                         |
| `data+0x1d66` | `monthNames`           | pointers: "September " … "April "                                       |
| `data+0x1d86` | `yearNames`            | ", 1418 s.r.", ", 1419 s.r."                                            |
| `data+0x1da0` | `amPm`                 | " a.m. ", " p.m. "                                                      |
| `data+0x1de8` | `roster`               | 196 × 38-byte records                                                   |
| `data+0x3b00` | `routes`               | 86 × 8 Place numbers                                                    |
| `data+0x3db0` | `objectPlacements`     | 30 × 6                                                                  |
| `data+0x3e64` | `day`                  | word                                                                    |
| `data+0x3e66` | `quarterHour`          | word, 0–95                                                              |
| `data+0x3e68` | `councilPending`       | byte, 1 at the start; cleared by the Council of Elrond                  |
| `data+0x3e69` | `eventMask`            | byte                                                                    |
| `data+0x3e6a` | `ringBearer`           | byte; also base of `eventDay[bit]`                                      |
| `data+0x3e72` | `places`               | 85 × 10                                                                 |
| `data+0x41c4` | `speedTable`           | 2 × 6 words                                                             |
| `data+0x41dc` | `stepDx`               | 8 words, one-pixel steps by facing                                      |
| `data+0x41ec` | `stepDy`               | 8 words, one-pixel steps by facing                                      |
| `data+0x41fc` | `facingDx`             | 8 words                                                                 |
| `data+0x420c` | `facingDy`             | 8 words                                                                 |
| `data+0x421c` | `facingBySign`         | 11 bytes, indexed -1..9 from `data+0x421d`                              |
| `data+0x4227` | `steeringWeights`      | 8 bytes, 100 69 39 19 9 19 39 69                                        |
| `data+0x422f` | `passedCopyProtection` | byte                                                                    |
| `data+0x4230` | `monthStart`           | 8 words                                                                 |
| `data+0x4242` | `terrainByTile`        | 256 bytes                                                               |
| `data+0x4342` | `objects`              | 17 × 8                                                                  |
| `data+0x4ac8` | `fullMapPalette`       | 16 RGB4 words                                                           |
| `data+0x4b48` | `animationPalette`     | the Animation Level's 32 RGB4 colours                                   |
| `data+0x4c72` | `pointerShown`         | byte, written as sprite DMA is switched; presumably the pointer is on   |
| `data+0x4f40` | `blinkPhase`           | toggles each frame                                                      |
| `data+0x4fec` | `frameCounter`         | compared with `data+0x08c2` before a clock step                         |
| `data+0x4fee` | `vblankCount`          | word, 50 Hz                                                             |
| `data+0x4ff0` | `fightState`           | 1 Go there, 2 fight on the Animation Level, 3 Ignore it; 4–7 meetings   |
| `data+0x5014` | `frameTiles5`          | handle to AMaps.res IMAG 12, the 5-plane window frame tiles             |
| `data+0x5018` | `frameTiles`           | handle to AMaps.res IMAG 13, the window frame tiles                     |
| `data+0x501c` | `boxBitmap`            | the open message box's bitmap                                           |
| `data+0x5020` | `iconSheet`            | Campaign icon bitmap                                                    |
| `data+0x5032` | `messageDeadline`      | vblankCount at which the message box expires                            |
| `data+0x548a` | `listEntries`          | roster index per row of `listForcesNear`                                |
| `data+0x54ee` | `listStrengths`        | summed strength per row                                                 |
| `data+0x5552` | `lastButton`           | button id to act on                                                     |
| `data+0x5553` | `defaultButton`        | pressed when the message box expires                                    |
| `data+0x5555` | `mode`                 | 1 Full Map, 2 Campaign, 3 Animation Level                               |
| `data+0x555b` | `goodRows`             | byte, rows in the Good column                                           |
| `data+0x555c` | `evilRows`             | byte, rows in the Evil column                                           |
| `data+0x564a` | `encounterA`           | roster index of the non-Evil party of the last meeting                  |
| `data+0x564c` | `frmlHandles`          | loaded FRML resources by id                                             |
| `data+0x56b1` | `encounterB`           | roster index of the other party                                         |
| `data+0x56b3` | `tickEntry`            | roster entry the tick is on, 1–151                                      |
| `data+0x56b8` | `rowOptions`           | 20 words: 0 Charge, 1 Engage, 2 Withdraw, 3 Retreat, 4 gone, −1 charged |
| `data+0x56e0` | `sideTotals`           | 2 words, Good then Evil: strength still fighting                        |
