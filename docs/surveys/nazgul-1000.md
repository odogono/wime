# Nazgûl-axis survey (#274)

Axis c alone was run for **1,000 seed pairs per Player and knowledge mode**:
100 sim seeds (1–100) crossed with 10 Setup seeds (0–9), for 8,000 shuffled
campaigns. Objects and Encounters remain Classic. Every run has a day cap of 400. The matched Classic control is the committed
[#272 control](classic-objects-matched.json), on the same 100 sim seeds.

## Results

| Player     | Knowledge | Classic, matched 100 sim seeds | Axis c, 1,000 pairs | Final day: median [min,max] | Day caps |
| ---------- | --------- | ------------------------------ | ------------------- | --------------------------- | -------- |
| fellowship | memorised | 17.0%                          | 12.8%               | 118 [25,127]                | 0        |
| fellowship | live      | 17.0%                          | 12.8%               | 118 [25,127]                | 0        |
| muster     | memorised | 54.0%                          | 42.0%               | 126 [25,400]                | 3        |
| muster     | live      | 54.0%                          | 42.0%               | 126 [25,400]                | 3        |
| defensive  | memorised | 92.0%                          | 87.7%               | 236 [25,400]                | 7        |
| defensive  | live      | 92.0%                          | 87.7%               | 236 [25,400]                | 7        |
| random     | memorised | 0.0%                           | 0.0%                | 29 [11,279]                 | 0        |
| random     | live      | 0.0%                           | 0.0%                | 29 [11,279]                 | 0        |

Axis c makes every scripted plan lose more often: fellowship falls from
17.0% to 12.8%, muster from 54.0% to 42.0% and defensive from 92.0% to
87.7%. The random floor stays at 0%.

**Memorised and live are identical**, run for run. None of the
`tools/strategy.ts` plans reads where the riders are, so knowing their
starts changes no decision. The drop is therefore not a penalty for wrong
memory; it is what a rider starting somewhere new does to the same plan.
This axis cannot help meet the parent issue's bar (memorised falling while
live holds) until a Player looks at the riders. That is for #275 to weigh.

Part of the drop comes before the Council: the three scripted plans reach it
in 927/1,000 runs (median day 28, range 25–37), against 97/100 in the
control (median 27, range 25–43). Earliest final days fall from the
control's to day 25, so some riders now catch the Ring-bearer on the road
to Rivendell. Fellowship's Lost Ring endings rise from 71% to 73.8%.

There are 10 day caps, all in muster and defensive, and no softlocks. Every
configuration has zero failed acts: no plan issues an act that depends on a
rider's position.

These are 1,000 **seed pairs**, not 1,000 independent samples: ten Setups
share the same 100 sim seeds. The limits were not tuned after seeing these
results, and there is no automated win-rate threshold.

## Limits needing design review

Every row is provisional Scenario design, with its reason in
`web/src/sim/setup-limits.ts`. The most uncertain choices are:

- **Exclusion margin:** two tiles around Hobbiton, matching the Encounter
  axis. Waymeet, Tuckborough and Green Hills fall inside it, so no rider
  starts where three of the Classic riders do. A one-tile margin would keep
  them, at the cost of riders a tile and a half from Frodo.
- **Bree and Buckland are excluded** because Aragorn and Merry stand within
  a rider's meeting reach of them at the start; a rider there would fight on
  the first tick.
- **79, the Lord:** the widest set, including the White Towers; with speed 2
  he can reach Hobbiton fastest from anywhere.
- **84, 86, 87:** reach east to Midgewater Marsh and north to Deadman's Dike,
  the edges of Bree-land.
- **85:** may swing west to Michel Delving, across the Shire from its
  Classic Sarn Ford start.
- **Riders may share a Place.** Unlike objects, there is no distinct-tile
  rule; riders never fight each other.

## Reproduce

```sh
bun run extract-all
bun run survey --setup shuffled --axes c --seeds 100 --setup-seeds 10 --out docs/surveys/nazgul-1000.json
```

[Nazgûl-axis JSON](nazgul-1000.json) contains the complete ending counts,
milestones and failed acts by axis. The [Spec](../spec/shuffled-setup.md)
defines the limits, exclusion zone and the Ring-bearer trigger check.
