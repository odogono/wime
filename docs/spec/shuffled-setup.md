# Shuffled Setup

Shuffled Setup is a port addition; the original has no Setup generator. It
changes the starting data of the shipped Scenario, while keeping its rules.
The Classic Setup is the parsed, exported `starting-state.json`.

## Seeds and axes

`shuffleSetup(classic, setupSeed, axes)` is a pure function in `web/src/sim`.
It returns the same JSON shape that `createSim` already accepts, without
mutating the Classic Setup. With every axis off (`[]`), its result is exactly
the Classic Setup, including metadata and array order.

The Setup seed is an unsigned 32-bit integer, independent of the sim seed.
Each axis has a separate mulberry32 stream from `rng.ts`: its initial state
is the Setup seed XOR a permanent axis salt (a: `0x61`, b: `0x62`, c: `0x63`).
Enabling or disabling another axis must not change that stream's draws.
Nothing draws from or changes `SimState.rng` during generation.

- **a, objects:** implemented here.
- **b, Encounters:** areas and first days, with chances fixed.
- **c, Nazgûl:** the nine riders' start positions, with Default Orders fixed.

Unknown axes and invalid seeds fail. `createSim` and Demos are unchanged.

## In the app

- New Game offers the Classic Setup or a Shuffled Setup
  (docs/spec/title-menu.md). There is no setting for it and no way to
  enter a seed.
- A Shuffled Setup turns on axes a, b and c together, as one switch:
  `SHUFFLED_SETUP_AXES`, pinned rather than following every axis, so a
  later axis joins it only by a deliberate change noted in the changelog.
- Its Setup seed is drawn at random. The sim seed is the one every New
  Game uses, so a Setup seed alone gives the same start and the same
  dice.
- A game from a Shuffled Setup is labelled `Shuffled Setup <seed>`, the
  seed in decimal, over the in-game menu (docs/spec/game-menu.md) and
  over the Load lists when its save is selected. A Classic game shows
  nothing new.
- A save keeps the Setup seed beside the state (docs/spec/saving.md).
- Demos, chosen or idle, always play the Classic Setup they were
  recorded on.

## Object limits

`web/src/sim/setup-limits.ts` is the Scenario's hand-written limits table.
It has one row per filled Classic placement slot, in slot order, since
several slots contain the same object number
(`finding:objects-starting-placements`). Each row lists candidate Place
numbers and a reason. These are design choices, not recovered original
placements; no coordinates or extracted text belong in the table.

The generator places each object at its chosen Place's exact position, so
Take works (`finding:objects-take-from-the-ground`). It preserves the slot
order, object numbers and all other starting data. Objects already carried
by Characters stay with them: the Ring, an Elven blade and an Ancient sword.
Separate copies of those weapons on the ground still shuffle.

Tokens remain in regions appropriate to their Nation; their recipients are
established by `finding:mobilisation-token-table`. The Red Arrow is in the
Gondor–Rohan corridor; the Dwarven Ring near Erebor; the Silver Orb in the
northern Elven region; and the Sceptre along the northern route toward
Rivendell. The last choice deliberately preserves a northern courier trip
rather than placing the Sceptre at its Gondor recipient.

No two shuffled slots share a tile. This is stricter than permitting the
Classic Setup's existing shared tiles, and deliberately separates those
clusters. Each row's candidates are shuffled using axis a's stream, then a
deterministic matching assigns distinct tiles, moving earlier assignments
when necessary. It never retries seeds or falls back outside a candidate
set. An impossible limits table fails loudly; tests check the shipped table
over many seeds. There is no per-campaign balance or win-rate validation.

**Design review priorities:** all Token rows (especially the northern
Sceptre), the southern extra vial and potion, and the three separate Elven
blade rows. Their regional boundaries and travel distances are provisional.
Every row's reason lives beside its candidates so the maintainer can review
all limits in one place.

## Encounter limits

Axis b changes only `encounter.area` and `encounter.earliest_day` in roster
entries 152–195. These figures wait in areas rather than move
(`finding:forces-encounter-figures-wait-in-areas`). Their chance, allegiance,
strength, inventories, position and destination fields, and every other
roster field stay unchanged. The existing loader takes the shuffled JSON
without changes. Turning b off gives exactly the object-axis generator's
result for the same seed and switches.

`ENCOUNTER_LIMITS` in `setup-limits.ts` has one row per figure, identified by
roster number. Each row lists candidate areas as pairs of Place numbers,
an inclusive first-day range, and its design reason. An area is the
rectangle between those Places' tile origins, extending through the last
pixel of both end tiles. Repeating a Place means one whole tile. Axis b's
stream draws an area uniformly from that row, then an integer day uniformly
from the inclusive range, including when either choice is fixed. There are
no redraws, clipping or fallback areas.

The table contains no extracted coordinates. The areas are regional habitat
choices, not a new terrain check: Mirkwood spiders stay in the Mirkwood
region, mountain creatures near mountain passes, and Mordor figures around
its gates and interior. Existing road/settlement restrictions still apply
to folk (`finding:forces-folk-met-only-in-settlements`). Bilbo stays at
Rivendell with first day 0 so the Council still opens his chance; Tom
Bombadil, Galadriel and Saruman keep their homes. Treebeard uses the named
Derndingle tile. Círdan may be at either western Elven port. Radagast's
returning-advice rule and Bilbo's Council gate are unchanged
(`finding:forces-advisors-met-once`).

`ENCOUNTER_EXCLUSION_ZONES` reserves Hobbiton (Place 2) and every tile within
a Chebyshev distance of two tiles: a 5×5 square, including its edges and
corners. No candidate rectangle for any figure may intersect it, even if
that figure's first day is later. This lets the Ring-bearer leave the start
and move beyond its immediate neighbours without an Encounter. The margin
is an opening buffer, not a guarantee about later journeys or moving Evil
Forces. Tests check every candidate against it using exported Place data,
then check many generated seeds. The generator performs no per-campaign
balance validation.

**Design review priorities:** every area and day range is provisional. In
particular, review Círdan at Forlond (152), Treebeard at named Derndingle
(156), the broad Radagast region (157), the western balrog's southern reach
(185), all hostile day ranges (166–195), and the narrowed one-area rows
(153–156, 166, 175, 177–178, 184, 192). These concentrate some formerly
broad Encounters, so a fixed chance does not imply a fixed overall risk.
The table deliberately gives story-bound figures singleton candidate sets.

## Nazgûl limits

Axis c changes only `position` in roster entries 79–87, the nine riders.
Their destination and route, the Place queue of their Default Orders
(`finding:ai-default-orders-are-place-queues`), stay as they are, so a
moved rider rides from somewhere new toward the same Places. No other Evil
Force moves, and every other roster field stays unchanged. Axes b and c
both write the roster but change disjoint fields, and each draws only from
its own stream, so any order and combination of axes gives the same
result. Turning c off gives exactly the result of the other axes.

`NAZGUL_LIMITS` in `setup-limits.ts` has one row per rider, identified by
roster number. Each row lists candidate Places in the western Shire and
Bree-land, and its design reason. Axis c's stream draws one Place uniformly
per row, in row order, and the rider starts at that Place's exact position.
Riders may share a Place: they are one side and never fight each other, so
the object axis's distinct-tile rule is not needed.

`NAZGUL_EXCLUSION_ZONES` reserves Hobbiton (Place 2) and every tile within a
Chebyshev distance of two tiles, as for Encounters. A rider meets a Force
within 7 pixels (`MEETING_DISTANCE`), under half a tile, so the margin gives
the Ring-bearer at least two tiles' head start whichever way it leaves.
Waymeet, Tuckborough and Green Hills fall inside the zone, so the shuffle
never starts a rider where three of the Classic riders start; the Classic
third rider is a tile from Hobbiton. Bree and Buckland are not candidates:
Aragorn and Merry stand within a rider's reach of them at the start. Tests
check every real candidate against the zone and against every Good Force's
starting position, and that 1,000 Setups load and take a first tick
without a fight.

The "Ring-bearer near" trigger (`finding:ai-trigger-conditions`) cannot fire
from a moved rider. It is tested only for entries whose trigger byte has
bit 0 set, and it compares the Ring-bearer with that waiting entry. The
riders start awake with a trigger byte of 0, and no waiting entry moves, so
no start, on the first tick or later, fires it.

**Design review priorities:** the two-tile margin, the Lord's wide row
(79), the Midgewater and Deadman's Dike reaches (84, 86, 87), and rider 85's
westward swing to Michel Delving. All rows are provisional.

## Survey

`bun run survey` accepts `--setup classic|shuffled`, `--setup-seeds N`, and
`--axes a,b,c` in addition to its existing options. The defaults remain
Classic, one Setup seed, and axis a. `--axes ''` disables every axis.
Unknown axes fail rather than silently giving a partial shuffle.

For Shuffled Setup it crosses every sim seed in `[from, from + seeds)` with
every Setup seed in `[0, setup-seeds)`. Thus 100 sim seeds and 10 Setup seeds
mean 1,000 campaigns per Player and knowledge mode. Holding either count at
one varies only the other dimension. Classic uses just the sim seed range;
Setup seeds and axes have no effect there. The report records both ranges,
the axes and the total campaigns, alongside the existing outcome and
milestone statistics. Memorised knowledge always comes from Classic;
live knowledge comes from the campaign being played.

Failed acts retain their total, with additional a/b/c and unattributed
counts. An object-axis failure is attributable when a decision contains a
single object act, a failed Take at a remembered Classic placement that was
absent from the shuffled starting data. Other failures, including ambiguous
decisions with multiple object acts, remain unattributed. This is a
conservative attribution, not a claim that every failed act was caused by
shuffling. Axis b changes passive Encounters, which are not object acts;
its failed-act column stays zero rather than attributing incidental failures
to an Encounter. The same holds for axis c: no Player act depends on a
rider's position. No win-rate threshold is a CI check.
