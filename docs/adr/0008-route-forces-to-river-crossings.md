# Crossing movement: Forces route to river Crossings, by default

In the original a Force crosses a river by chance. Movement reads one terrain value per tile and steers greedily, so a Force that meets a river walks up and down the bank. At each tile origin, a one-in-ten roll steps it straight on, and it wades across at a fifth of its pace (finding:movement-rivers-crossed-by-the-straight-step). Fords and bridges are only road-over-river tiles, and movement neither seeks them nor knows they exist (finding:movement-fords-and-bridges-are-crossing-tiles). The result is a Force looping on a bank for days within reach of a ford (finding:movement-rivers-block-route-finding), which reads as a fault rather than a rule. The manual's talk of single crossings suggests the designers meant fords and bridges to matter.

Since ADR-0006 the sim reads the vector geography, so it knows where rivers run and where they are crossed. We decided to add a Movement rule, chosen on the New Game screen and fixed for the game. Under Crossing movement, any Force with a destination whose way meets a river heads first for a Crossing within reach, whether the player ordered it or it follows Default Orders. A Crossing is any spot where a road crosses a river, named or not. Passing through it is not an arrival: the Force does not rest there, and it is not announced. With no Crossing within reach, the Force moves as under Classic movement and may wade. Classic movement is the original's, exactly.

Crossing movement is the default, and so is the Atlas map. This departs from ADR-0002's behavioural fidelity in the default game. We accept that because the stall is the original's most visible fault, and the fix forbids nothing the original allows. Fidelity stays one choice away: Classic movement and the Classic map remain, and the reference-scenario tests run under Classic movement. The Demos show the default game, so they play under Crossing movement (#352). The Movement rule is kept in the save, and saves written before it load as Classic movement, the rule they were played under. This is the deliberate change to movement that ADR-0006 required its own ADR for. The Movement rule is separate from the map, which changes how the world is shown, never the rules.

## Considered Options

- Keep the original's movement: faithful, but Forces stall at rivers in sight of a ford.
- Make rivers impassable except at Crossings: matches the manual's wording, but forbids crossings the original allows and reshapes every route and AI timing.
- Charge a fixed cost for wading instead of the random roll: predictable, but it still never seeks out a ford.
- Route to Crossings only when the straight step fails for a day: closer to the original, but the stall still shows.
- Tie the rule to the Atlas map: one fewer setting, but the map would then change the rules.
- Default to Classic movement: faithful by default, but most players would meet the stall and never find the fix.
