# War in Middle Earth

A browser port of War in Middle Earth (Melbourne House, 1988), rebuilt from the
Amiga version's behaviour. It is not an emulator: the game is reimplemented in
TypeScript from specs recovered from the original (ADR-0001).

## Status

The game is complete for 1.0. All three Levels (Animation, Campaign and Full
Map), Orders, meetings and recruitment, the Council of Elrond, combat, objects,
War Events and mobilisation, all four endings, music and sound, Game Speed and
pause, and saving and loading are in place. What the port does is described in
[`docs/spec/`](docs/spec/).

## Supported browsers

The latest desktop Chrome, Firefox and Safari, with a mouse and keyboard. Touch
and mobile devices are not supported.

## Running it

The game's data is not in this repository. You need your own copy of the
original game files in `artifacts/`; see [`AGENTS.md`](AGENTS.md).

```sh
bun install
bun run extract-all
bun run dev
```

## Deliberate differences from the original

- **After an ending, a menu.** The original quits when X is pressed on the
  ending's last page. The port opens a menu instead, to return to the title or
  load a save (#235, [`winning-and-losing.md`](docs/spec/winning-and-losing.md)).
- **The browser's pointer.** Clicks land at the browser pointer's hotspot, not
  the hand pointer's fingertip
  ([`animation-level.md`](docs/spec/animation-level.md)).
- **Named save slots and autosave.** The original has one save slot. The port
  keeps several named slots in the browser, autosaves, and offers Resume
  ([`saving.md`](docs/spec/saving.md)).
- **No copy-protection check.** The original's map-coordinates question is not
  asked.
- **Not exact to the original's random numbers.** Odds match, but the same
  choices do not replay the same rolls.
- **Amiga artwork only.** The DOS and Apple IIgs versions' artwork is not used.

These smaller differences are accepted for 1.0, each explained in its spec:

- After refusing an Order, the port drops the pick and the player picks again;
  the original seems to roll again by itself
  ([`movement.md`](docs/spec/movement.md)).
- On the Animation Level, off-screen Forces move together at the end of each
  sweep, not one a frame; the order of events is the same
  ([`animation-level.md`](docs/spec/animation-level.md)).
- Leaving the Animation Level closes an open message box, pressing its default,
  as leaving the other Levels does ([`time.md`](docs/spec/time.md)).
- The one-line "GOLLUM quietly sneaks away." box is drawn as tall as a two-line
  box ([`forces.md`](docs/spec/forces.md)).

## Development

See [`AGENTS.md`](AGENTS.md) for the code map and tools, and
[`CODING_STANDARDS.md`](CODING_STANDARDS.md). Run `bun run check` before a PR.

With exported assets, `bun run survey` measures campaign outcomes on the Classic
Setup for the `fellowship`, `muster`, `defensive` and `random` Players, each using
`memorised` and `live` knowledge of the Setup. Memorised knowledge reads the
Classic starting data; live knowledge reads the campaign state. Moving Forces
and the player's own inventory remain observations in both modes.

```sh
bun run survey --seeds 1000 --from 1 --days 400 --out report.json
bun run survey --players muster,random --knowledge live --seeds 2
```

The tables and JSON report ending counts, win rates, final-day spreads, milestone
days and failed object acts. Days are absolute campaign days; spreads use the
minimum, median and maximum, with the number of observations. A milestone that
never happened has count zero and null days. A day cap and a clock stalled for
10,000 steps are counted separately. Failed acts are object commands with no
effect, including a Take based on a wrong memorised placement; Order refusals
are excluded. The [1,000-seed baseline](docs/surveys/classic-1000.json) uses seeds
1–1,000 and the day-400 cap. No win-rate thresholds run in CI.
