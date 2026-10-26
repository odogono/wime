# Encounter-axis survey (#273)

Axis b alone was run for **1,000 seed pairs per Player and knowledge mode**:
100 sim seeds (1–100) crossed with 10 Setup seeds (0–9), for 8,000 shuffled
campaigns. Objects and Nazgûl starts remain Classic. Every run has a day cap
of 400. The matched Classic control uses the same 100 sim seeds; repeating
it for each Setup seed would duplicate campaigns. A fresh control on this
branch exactly matches the committed [#272 control](classic-objects-matched.json)
after parsing JSON, so the report reuses that file.

## Results

| Player     | Knowledge | Classic, matched 100 sim seeds | Axis b, 1,000 pairs | Final day: median [min,max] | Day caps |
| ---------- | --------- | ------------------------------ | ------------------- | --------------------------- | -------- |
| fellowship | memorised | 17.0%                          | 23.7%               | 118 [31,129]                | 0        |
| fellowship | live      | 17.0%                          | 21.7%               | 118 [31,130]                | 0        |
| muster     | memorised | 54.0%                          | 50.8%               | 126 [31,400]                | 8        |
| muster     | live      | 54.0%                          | 44.6%               | 125 [31,400]                | 4        |
| defensive  | memorised | 92.0%                          | 92.8%               | 235 [31,400]                | 8        |
| defensive  | live      | 92.0%                          | 87.9%               | 233 [31,400]                | 5        |
| random     | memorised | 0.0%                           | 0.0%                | 29 [11,307]                 | 0        |
| random     | live      | 0.0%                           | 0.0%                | 29 [11,307]                 | 0        |

Axis b alone does **not** break the memorised plans. Fellowship improves
from 17.0% to 23.7%; muster declines from 54.0% to 50.8%; defensive remains
close to its control at 92.8%. All three live plans win less often than their
memorised counterparts on this seed grid: fellowship 21.7%, muster 44.6%,
and defensive 87.9%. The random floor remains 0% in both modes.

The live policies use the actual Encounter areas, but their existing route
heuristics are not an optimal adaptive Player: knowing the new areas is not
a guaranteed ceiling on success. Area size also determines which Encounters
they try to avoid (`encounterAreas` in `tools/strategy.ts`). Different routes,
areas and first days can change which Encounter checks consume the sim RNG,
so this survey does not isolate a causal penalty for wrong remembered areas.
No Player logic was changed for this axis. The combined-axis assessment
remains #275; this result does not establish the parent issue's app bar.

There are 25 day caps across the 8,000 campaigns, all in muster and
defensive, and no softlocks. A cap means no ending by day 400, rather than a
stopped clock. Every configuration has zero failed acts. Those count object
commands with no effect, not attacks, lost Characters or missed advisors;
zero in the b column is therefore not evidence that Encounter knowledge was
correct.

For the three scripted Players, the Council occurs in 978/1,000 memorised
runs (median day 27, range 25–47) and 924/1,000 live runs (median day 28,
range 19–55). The matched Classic control reaches it in 97/100 runs (median
27, range 25–43). First Mobilisation medians are 110/111 for fellowship,
90/91 for muster, and 149/149 for defensive (memorised/live); the control
medians are 111, 90 and 149. The JSON includes every War Event spread and all
ending counts.

These are 1,000 **seed pairs**, not 1,000 distinct Setups or independent
statistical samples: ten Setups share the same 100 sim seeds, and knowledge
modes share both ranges. The limits were not tuned after seeing these
results, and there is no automated win-rate threshold.

## Limits needing design review

Every candidate boundary and first-day range is provisional Scenario design,
with a reason beside its row in `web/src/sim/setup-limits.ts`. The most
uncertain choices are:

- **152:** Círdan may appear at Forlond instead of the Grey Havens.
- **156:** Treebeard uses the named Derndingle tile rather than his Classic
  tile nearby.
- **157:** Radagast may range along the northern road or western mountain
  approaches; the second region needs a habitat review.
- **185:** the western balrog may range south toward Isengard. This is the
  least certain hostile regional boundary.
- **166–195:** all hostile first-day ranges need a pacing review, especially
  the balrogs' minimum of day 5. Their chances are fixed, but later first
  days and different area sizes still change exposure and difficulty.
- **153–156, 166, 175, 177–178, 184, 192:** singleton area choices deliberately
  retain a home or distinctive habitat. Several narrow previously broader
  Encounters; their effect should be reviewed alongside the movable rows.
- **All rows, 152–195:** the remaining area boundaries and friendly day
  ranges are also provisional, rather than recovered original limits.

The opening buffer is a two-tile Chebyshev margin around Hobbiton, a 5×5
square. Every candidate area for every figure is outside it, including
friendly figures and Encounters that start later. Tests check the complete
candidate table against exported Place data as well as 1,000 generated
Setups. Habitat limits are regional rectangles anchored at named Places,
not a new per-tile terrain restriction.

## Reproduce

```sh
bun run extract-all
bun run survey --setup classic --seeds 100
bun run survey --setup shuffled --axes b --seeds 100 --setup-seeds 10 --out docs/surveys/encounters-1000.json
```

[Encounter-axis JSON](encounters-1000.json) contains the complete ending
counts, final-day spreads, Council, first Mobilisation and War Event
statistics, and failed acts by axis. The [Spec](../spec/shuffled-setup.md)
defines the area encoding, exclusion zone and independent RNG streams.
