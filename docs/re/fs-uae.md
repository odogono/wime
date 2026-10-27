# Running the original in FS-UAE

How an agent boots the Reference Build in FS-UAE 3.2 and reads its state, for Reference runs and `observed:` Findings. The `*-reference.md` notes beside this one record particular Reference runs; this is the setup they share.

Read state from memory dumps, not screenshots: a dump costs a few bytes, an image hundreds of kilobytes. Capture the screen only when the picture is the evidence.

## Boot drive

`bun run fs-uae:setup` builds `build/fs-uae/` (gitignored) in the current checkout: `dh0/` is the WHDLoad install from the archive, with WHDLoad 18.5 and the Kickstart 1.3 image it needs, and `wime.fs-uae` boots it on an A500+ with Kickstart 2.04, 1 MB chip and 4 MB fast memory. The tool reads WHDLoad and the ROMs from FS-UAE's directory (`FS_UAE_DIR`, default `~/games/amiga/FS-UAE`). Each worktree needs its own drive, since `hard_drive_0` is an absolute path. With 1 MB of chip memory the game skips the Credits; set `chip_memory = 2048` in `wime.fs-uae` to see them.

## Launching

`tools/fs-uae/run.sh` launches the emulator with its debugger on a pipe and writes its pid to `build/fs-uae/pid`. `fs-uae` is not on PATH: the script runs `/Applications/FS-UAE.app/Contents/MacOS/fs-uae` (`FS_UAE_BIN` overrides it). Stop it with `pkill -f 'fs-uae wime'; pkill -f 'tail -f debugger.in'`.

`tools/fs-uae/boot-to-campaign.sh` launches it and plays through to the Campaign Level in about 100 s: Space skips each boot screen (clicks do not, finding:ui-boot-sequence-key-skips), and Gandalf's letter closes by itself. It turns the day-92 question off, moves the pointer off the map's edge, and snaps `build/fs-uae/campaign.png`. Run it in the background.

Screen capture and CGEvent posting need the Bash sandbox disabled. The host app needs Screen Recording and Accessibility permission.

## The debugger

Append debugger commands to `build/fs-uae/debugger.in`. Enter the debugger with F12+D: `osascript -l JavaScript tools/fs-uae/chord.jxa.js 111 2`.

- Read state from `S <file> <addr> <len>` dumps, since console output is buffered. Give each dump a fresh, short name, such as `/tmp/wime-<n>`: a name another session used may be a stale file or a symlink into another worktree, and the debugger truncates input lines at about 100 characters. Delete a dump path before reusing it, and wait for the file to appear.
- Commands sent while the game runs are queued and fire at the next stop, whichever stop that is. `g` resumes.
- There is no load command: restore memory with short `W <addr> <bytes…>` lines.
- `fd` adds a bogus breakpoint rather than clearing them, and `f <addr>` toggles one.
- The F12+D chord is sometimes lost. Retry it until the dump appears, or, to sample an event repeatedly, set a breakpoint on it and queue an `S` dump and a `g` per hit: each stop dumps with no chord ([`game-speed-reference.md`](game-speed-reference.md)). `grep -ac 'Next PC:' build/fs-uae/stdout.txt` counts the stops so far.

## Addresses at run time

The code hunk loads at 0x1D0C8, so `code+X` is at 0x1D0C8 + X. The data hunk loaded at 0x390E8 (A4 − 0x7ffe); re-verify it each boot by finding the speed table at `data+0x41c4`. With that base:

| What                                   | Address                    | Note                                                   |
| -------------------------------------- | -------------------------- | ------------------------------------------------------ |
| the whole data hunk                    | `S /tmp/wime-1 390e8 5a04` | offsets into the dump are data offsets                 |
| day, quarter-hour                      | 0x3CF4C, 0x3CF4E           | words; `W 3cf4e 0 28` sets 10 a.m.                     |
| roster entry i                         | 0x3AED0 + 38·i             | position words at +8 and +10, carried objects at +0x10 |
| the day-92 question, `data+0x422f`     | `W 3d317 1`                | turns it off; the port never has it                    |
| the Game Speed limit, `data+0x08c2`    | `W 399aa 0 10`             | 0x10 runs time fast; 0 is Very Hasty                   |
| the Campaign Level view, `data+0x08c8` | `W 399b0 01 e0 01 10`      | x 480, y 272: the Shire                                |
| the pointer, `data+0x5026`             | read only                  | a write does not stick: the input code puts it back    |

Moving a figure under the pointer, by writing its roster position, is easier than steering the pointer onto it.

## Input

`cliclick` clicks do not reach FS-UAE. Post events as CGEvents with the JXA scripts in `tools/fs-uae/`: `click.jxa.js X Y`, `press.jxa.js X Y`, `move.jxa.js X0 Y0 X1 Y1 STEPS`, `key.jxa.js KEYCODE…`, `chord.jxa.js KEYCODE…`.

- CGEvents go to the frontmost app, and another app can take focus at any time, so run `tools/fs-uae/focus.sh &&` before every key or click. It activates FS-UAE by pid (activating by process name fails) and exits non-zero unless FS-UAE is frontmost.
- macOS keycodes: Space 49, U 32 (up a Level), M 46 (down, the magnifying glass), O 31 (provisions), S 1 (the eye), T 17 (Game Speed), N 45 (No), Q 12 (sound), F12 111 and D 2 (the debugger).
- After a debugger stop, M has been seen not to reach the game while other keys did. Click the icon instead.
- The Amiga pointer is relative and moves about 1 lo-res pixel per 2 host points. `tools/fs-uae/aim.sh DX DY` parks it in the top-left corner and moves it by DX, DY host points; then `press.jxa.js` clicks without moving it, where `click.jxa.js` moves first. A click lands at the pointer's top-left plus (width − 1, 6).
- Resting the pointer on the map's edge scrolls the Campaign Level, and the clock never ticks while it scrolls.

## Screenshots

`tools/fs-uae/snap.sh OUT.png` captures the window and writes a copy at most 900 px wide to `OUT.s.png`. Read the small copy.

Keep captures in `build/fs-uae/` and dumps under `/tmp/wime-*`: both come from the original and are never committed. No reference captures are kept between sessions; take new ones.
