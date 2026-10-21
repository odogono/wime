# Running the original in FS-UAE

How an agent boots the Reference Build in FS-UAE 3.2 and reads its state, for Reference runs and `observed:` Findings. The `*-reference.md` notes beside this one record particular Reference runs; this is the setup they share.

## Boot drive

`bun run fs-uae:setup` builds `build/fs-uae/` (gitignored) in the current checkout: `dh0/` is the WHDLoad install from the archive, with WHDLoad 18.5 and the Kickstart 1.3 image it needs, and `wime.fs-uae` boots it on an A500+ with Kickstart 2.04, 1 MB chip and 4 MB fast memory. The tool reads WHDLoad and the ROMs from FS-UAE's directory (`FS_UAE_DIR`, default `~/games/amiga/FS-UAE`). Each worktree needs its own drive, since `hard_drive_0` is an absolute path.

## Launching and the debugger

```sh
tail -f build/fs-uae/debugger.in | fs-uae build/fs-uae/wime.fs-uae > build/fs-uae/stdout.txt
```

Append debugger commands to `build/fs-uae/debugger.in`. Enter the debugger with F12+D: `osascript -l JavaScript tools/fs-uae/chord.jxa.js 111 2`.

- The debugger truncates input lines at about 100 characters. There is no load command: restore memory with short `W` lines.
- `fd` adds a bogus breakpoint rather than clearing them, and `f <addr>` toggles one.
- Console output is buffered, so read state from `S <file> <addr> <len>` dumps to a short path such as `/tmp/d`, not from stdout.
- Commands sent while the game runs are queued and fire at the next stop.
- The F12+D chord is sometimes lost. To sample an event repeatedly, set a breakpoint on it and queue an `S` dump and a `g` per hit instead: each stop dumps with no chord ([`game-speed-reference.md`](game-speed-reference.md)).

## Addresses at run time

The code hunk loads at 0x1D0C8, so `code+X` is at 0x1D0C8 + X. The data hunk loaded at 0x390E8 (A4 − 0x7ffe); re-verify it each boot by finding the speed table at `data+0x41c4`. With that base, day is 0x3CF4C, quarter-hour 0x3CF4E, and roster entry i is at 0x3AED0 + 38·i. `S /tmp/d 390e8 5a04` dumps the whole data hunk.

Set `data+0x422f` to 1 to skip the day-92 question, and `data+0x08c2` to 0x10 for fast time.

## Input and screenshots

`cliclick` clicks do not reach FS-UAE. Post events as CGEvents with the JXA scripts in `tools/fs-uae/`: `click.jxa.js X Y`, `move.jxa.js X0 Y0 X1 Y1 STEPS`, `key.jxa.js KEYCODE…`, `chord.jxa.js KEYCODE…`. The Amiga pointer is relative and moves about 2 window points per host point; resting it on the map edge scrolls the Campaign Level and the clock never ticks.

`tools/fs-uae/snap.sh OUT.png` captures the window and writes a copy at most 900 px wide to `OUT.s.png`. Read the small copy, and only when the picture is the evidence: to wait for a screen or check state, poll memory with `S` dumps, which cost a few bytes rather than an image.

Screen capture and CGEvent posting need the Bash sandbox disabled, and FS-UAE frontmost (activate it through System Events). The host app needs Screen Recording and Accessibility permission.

Keep dumps and captures in `build/fs-uae/`: they come from the original and are never committed. No reference captures are kept between sessions; take new ones.
