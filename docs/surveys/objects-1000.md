# Object-axis survey (#272)

Axis a alone was run for **1,000 seed pairs per Player and knowledge mode**:
100 sim seeds (1–100) crossed with 10 Setup seeds (0–9), for 8,000 shuffled
campaigns. The matched Classic control uses the same 100 sim seeds; repeating
it for each Setup seed would duplicate the same campaigns. The earlier
1,000-sim-seed Classic baseline from #271 is also shown for context. All runs
use a day cap of 400.

| Player     | Knowledge | Classic, 1,000 sim seeds | Classic, matched 100 sim seeds | Shuffled, 1,000 pairs | Failed acts: a | Unattributed |
| ---------- | --------- | ------------------------ | ------------------------------ | --------------------- | -------------- | ------------ |
| fellowship | memorised | 18.2%                    | 17.0%                          | 17.0%                 | 0              | 0            |
| fellowship | live      | 18.2%                    | 17.0%                          | 17.0%                 | 0              | 0            |
| muster     | memorised | 47.8%                    | 54.0%                          | 54.0%                 | 0              | 0            |
| muster     | live      | 47.8%                    | 54.0%                          | 54.0%                 | 0              | 0            |
| defensive  | memorised | 90.9%                    | 92.0%                          | 92.0%                 | 0              | 0            |
| defensive  | live      | 90.9%                    | 92.0%                          | 92.0%                 | 0              | 0            |
| random     | memorised | 0.0%                     | 0.0%                           | 0.0%                  | 0              | 0            |
| random     | live      | 0.0%                     | 0.0%                           | 0.0%                  | 0              | 0            |

The shuffled win rates equal the matched Classic rates in both knowledge
modes. Each shuffled ending count and milestone observation count is ten
times its matched Classic count, and the final-day and milestone spreads
are identical. There are no failed object acts, day caps or softlocks.

This result reflects the current Players: `policyFor` disables Tokens for
fellowship and defensive, and for muster with its default open war. The
random Player gives Orders and answers meetings, without object acts.
These Players therefore do not test the value of remembering object
placements. Axis a alone does not break their plans. This is not evidence
that a human plan which collects objects is insensitive to the shuffle;
that needs an object-using Player or Token-enabled survey configuration.
The focused survey test exercises such a Token errand and pins attribution
of a wrong remembered Take to axis a. The default Players are unchanged.

The 1,000 shuffled campaigns per configuration share both sim seeds and
Setups. They are not 1,000 distinct Setups or independent statistical
samples. The matching algorithm also does not claim a uniform distribution
over all legal placements. These numbers describe this seed grid and these
plans; there is no automated win-rate threshold.

## Reproduce

```sh
bun run extract-all
bun run survey --setup classic --seeds 100 --out docs/surveys/classic-objects-matched.json
bun run survey --setup shuffled --axes a --seeds 100 --setup-seeds 10 --out docs/surveys/objects-1000.json
```

[Matched Classic JSON](classic-objects-matched.json) and
[object-axis JSON](objects-1000.json) include all ending counts, final-day
spreads, Council, first Mobilisation and War Event statistics, and failed
acts by axis. [The earlier Classic baseline](classic-1000.json) records
1,000 sim seeds and was produced by #271, before this change.

The limits table remains a design review: see the provisional rows and
reasons in `web/src/sim/setup-limits.ts`, particularly the Tokens, three
Elven blades and southern extra vial and potion. The Spec is
[Shuffled Setup](../spec/shuffled-setup.md).
