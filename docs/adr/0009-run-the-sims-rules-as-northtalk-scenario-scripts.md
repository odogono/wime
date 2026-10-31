# The sim's rules can run as NorthTalk Scenario Scripts, on the TS Core

The sim's rules are TypeScript, so the engine can only ever play the Scenario the original shipped with. Spike #194 asked whether the rules could instead run as Scenario Scripts in [NorthTalk](https://github.com/odogono/odgn-talk), a sandboxed interpreter that runs synchronously in host-driven pumps and takes its time only from the host, as ADR-0002 requires. The prototype (branch `spike/northtalk`, which never merges) moved the movement sweep under both Movement rules (ADR-0008), the Crossing choice, the daily War Events and the Way Queries into Scenario Scripts. It played them in lockstep against the TypeScript sim.

We decided to go ahead, on NorthTalk's TS Core, once NorthTalk releases the delivery fix below and the pin is bumped. The scripted sim reproduced the TypeScript sim exactly, and in Chromium it already fits the time budget on NorthTalk 0.5.0. Moving the rest of the rules is the migration below, done one rule at a time behind the differential test.

## The engine's surface

- **Engine Primitives** are the fixed Operations the engine grants every Scenario: `draw(n)` (mulberry32 on `SimState.rng`), `mark` and `reset` (the RNG state, so a held step leaves no trace), `terrain(x, y)` and `text(id)`. A text ID is a location in the Reference Build, such as `code+0x0e2c1`, which the export resolves into a text table, so Scenario Scripts hold no English.
- **Engine Natives** would be TypeScript stand-ins for slow script paths. None was needed.
- **The view contract:** the view reads the engine's fixed, typed **core state**, changes it only through **Commands** (player actions, run by Scenario Scripts) and asks read-only, synchronous **Queries** (`wayOf`, `orderedWay`). Scenario Scripts keep their own state in a `scenario` record the view never reads; `crossingLegs` moved there. Save version 11 adds it, and older saves move their `crossingLegs` into it on load.
- **State stays host-owned.** Each handler takes core and scenario state and returns new state. Saves stay JSON through `save.ts`, never NorthTalk's `group.save()`, so they aren't tied to one Core. Unchanging Scenario data (Places, speeds, Waterways) is loaded into the Group once per game.
- **Faults:** a script error or a Limit Fault makes `tickSim` throw and leaves the state unchanged.

## Fidelity

Scripts use NorthTalk's exact decimals where the TypeScript sim uses doubles, so the Crossing geometry could round differently. It never did:

- **Differential test:** both Movement rules × the Classic Setup and Setup seeds 7 and 8 × seeds 1 to 3, 30 game days each, compared after every tick: 18 games, no diff and no Crossing chosen differently.
- **Demos:** fellowship, muster and defensive, under Crossing movement, identical at every step to their endings on days 119, 137 and 220.
- **Survey** (#271): the same report from both sims (Classic movement; the survey tool doesn't play Crossing movement).
- **Saves:** a scripted save round-trips through `save.ts`, and a TypeScript save loads into the scripted sim and plays on with no diff.

## Speed

The budget is 5 ms per tick at p95 in the browser, mid-campaign with the full roster, under Crossing movement. Very Hasty runs one tick per 20 ms frame. All figures are at day 100 of the fellowship Demo, with 196 roster entries.

| Headless Chromium 156, NorthTalk 0.5.0 | Crossing tick p50 / p95 | Classic tick p50 / p95 | `orderedWay` p50 / p95, Crossing |
| -------------------------------------- | ----------------------- | ---------------------- | -------------------------------- |
| TS Core, as published                  | 4.1 / 4.5 ms            | 3.9 / 4.1 ms           | 1.7 / 6.0 ms                     |
| TS Core, with the delivery fix         | 0.8 / 1.4 ms            | 0.8 / 0.9 ms           | 1.4 / 5.5 ms                     |
| Zig Core's WASM reactor                | 19.6 / 22 ms            | 19.3 / 20.8 ms         | 2.3 / 3.4 ms                     |
| TypeScript sim, for comparison         | 0.003 ms                | 0.003 ms               | —                                |

- **Fuel per tick:** about 42k at p50, 43k at p95 and 78k at the worst, when many Forces choose a Crossing at once. Fuel per Run is set at 200M.
- **Converting state:** under 0.1 ms per tick at p95.
- **The worst single ticks** reach about 30 ms, once or twice in 500. The spike didn't isolate their cause; garbage collection and ticks where several Forces choose a Crossing at once are the likely ones.
- **Loading the Scenario Scripts:** about 300 ms, once per game.

Four changes got the prototype from 29 ms at p95 under Bun to these figures:

1. **The host caches Values.** Each plain object and the Value made from it are remembered as a pair. A roster entry a tick leaves alone crosses as the same Value, which NorthTalk has already measured. This relies on the sim never changing state in place.
2. **The scripts skip what can't change.** The sweep passes over entries that can't wake or move, and searches the War Events that have happened rather than every trigger bit.
3. **The waterway geometry skips what a Way can't meet.** Each river is split into boxed runs of 16 segments. A run is tested only if the Way's line can pass through its box, a test that uses products alone, so it stays exact.
4. **NorthTalk's delivery fix (pending):** NorthTalk 0.5.0 renders every delivery's arguments as Trace text even with no Trace sink, and walks them for Function Values. Building the line only when a sink is set, and remembering Values that hold no Function, removes most of what's left of a tick.

Under Bun the published package gives 3.2 / 6.2 ms per Crossing tick, so the fix matters on slower machines. `orderedWay` runs only when a hover moves to a new tile. At about 6 ms p95 it is over the 5 ms budget, so the view should keep asking it once per tile.

## Considered Options

- **The Zig Core's WASM reactor:** its interpreter is faster, but each request copies the whole world into the guest's own heap, and each Engine Primitive call crosses back into JavaScript. For a host that passes state in and out every tick it is about 4× slower than the TS Core. It would need the state to live in the guest, which decision 6 rules out.
- **Keeping the Scenario's state in the scripts between ticks:** this would avoid passing the world each tick, but saves would then depend on a NorthTalk Core, and the view couldn't read core state directly. Value caching gives most of the gain without either cost.
- **Engine Natives for the waterway geometry:** not needed. Exact decimals matched the doubles in every game played, and boxed runs made the geometry fast enough.
- **Staying with TypeScript rules:** fastest by far, but only ever the one Scenario.

## Consequences

- **The migration** moves the rest of `web/src/sim` into the shipped game's Scenario Scripts, one rule at a time, each behind the differential test:
  - the Commands: Orders, `applyObject` and the Ring, combat (`resolveFight`, `fightRound`), meetings (`answerMeeting`), the Council, recruiting (`use.ts`), the Mirror and the endings;
  - the Queries: `forcesOnMap` and the others the view asks;
  - the clock's hourly and daily checks, and starting a game (`createSim`).

  The Shuffled Setup's limits table (`setup-limits.ts`) moves into the Scenario format when there is one. Choosing and loading Scenarios, and the Scenario format itself, are their own work.

- **The pin:** `@northtalk/ts` stays pinned to an exact version. The switch waits for a release with the delivery fix, and every measurement names its NorthTalk version.
- **The view** must not ask `orderedWay` more than once per hovered tile.
- **Tests:** whole-campaign tests take several times longer on the scripted sim. The test suite will need longer timeouts, or fewer seeds, for those tests.
- **Writing Scenario Scripts:** NorthTalk's ranges only count up (`7..0` is empty), its chunk words (`first`, `line`, `next`, `last`) and reserved words can't be names, and a Function's name can't be reused as a variable. The differential test catches the slips; the Fuel figures don't.
- **The terms** Engine Primitive, Engine Native, Command and Query describe the engine, not the game, so they are defined here, not in `GLOSSARY.md`.
