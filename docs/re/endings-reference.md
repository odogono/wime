# Endings reference scenarios

The `observed:ending-…` scenarios in the Findings are these runs, made in FS-UAE 3.2 on the Reference Build (issue #103). Each writes the game's memory on the Campaign Level and lets the game's own checks find the ending.

## Setting up

1. Boot as in [the combat reference](combat-reference.md) and reach the Campaign Level. The code hunk was at 0x1D0C8 and the data hunk at 0x390E8; roster entry i is at 0x3AED0 + 38 × i. Write 1 to `data+0x422f` (0x3D317) to skip the copy-protection question; this is test scaffolding only.
2. Break on `winGame` (`code+0x02e64`, `f 1ff2c`) and `loseGame` (`code+0x0296c`, `f 1fa34`). For the Mount Doom runs also break on the hourly update, `code+0x0d894` (`f 2a95c`), and write the position there: a Leader written onto Mount Doom between hours walks off it before the hour comes.
3. A Leader turns only on tile origins, so start a mover on one, or set its facing, byte 21, yourself (2 is east).

## Scenarios

| Scenario                           | Set-up                                                                                                                                                                         | Observed                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ending-ring-at-mount-doom`        | Frodo (7), objects 0x0011, Ring-bearer, no leader. At the hourly break, his position set to (1808, 1120).                                                                      | `winGame` in that hourly update. The Animation Level opens on Hobbiton with the Free Peoples in a row, then BScene CSTR 53, 54 and 55, one box at a time. |
| `ending-evil-bearer-at-mount-doom` | Nazgûl entry 79 (allegiance 0, no leader) given the Ring (objects 0x0001, Frodo's 0x0010) and made Ring-bearer (`data+0x3e6a` = 79). At the hourly break, set at (1808, 1120). | `winGame`, with the same scene and pages: no allegiance test.                                                                                             |
| `ending-ring-at-barad-dur`         | The same Nazgûl at (1840, 1120), heading for (1856, 1120).                                                                                                                     | `loseGame` with the Nazgûl on (1856, 1120). The Animation Level opens on Mount Doom with orcs, a troll and a balrog, then CSTR 49, 51 and 52.             |
| `ending-ring-at-isengard`          | The same Nazgûl one pixel west of Isengard, (1088, 896), facing east.                                                                                                          | It arrived and walked on. Neither ending was called and the clock ran on.                                                                                 |

On every ending the first two boxes close by themselves after about 21 seconds, or at once on a key such as space. The last box ignores space, return, letters and clicks; X quits the game to the AmigaDOS prompt.

Keep the dumps and screenshots in a gitignored directory such as `build/fs-uae/`; they are taken from the original and are never committed.
