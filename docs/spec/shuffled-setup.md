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
- **b, Encounters:** reserved for #273; areas and first days, with chances fixed.
- **c, Nazgûl:** reserved for #274; rider positions, with Default Orders fixed.

Until implemented, requesting b or c fails explicitly. Unknown axes and
invalid seeds also fail. No view, save, Demo or `createSim` changes are needed.

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

## Survey

`bun run survey` accepts `--setup classic|shuffled`, `--setup-seeds N`, and
`--axes a,b,c` in addition to its existing options. The defaults remain
Classic, one Setup seed, and axis a. `--axes ''` disables every axis.
Reserved axes fail rather than silently giving a partial shuffle.

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
shuffling. No win-rate threshold is a CI check.
