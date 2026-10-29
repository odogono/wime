# Crossing movement

Crossing movement is a port addition (ADR-0008); the original has no
Movement rule. Under it, a Force whose way to its destination meets a
river heads first for a Crossing, instead of walking the bank until a
straight step wades it across (`finding:movement-rivers-crossed-by-the-straight-step`,
`finding:movement-rivers-block-route-finding`). Classic movement is the
original's, exactly as `docs/spec/movement.md` describes; everything
here applies only under Crossing movement, and changes nothing but
where a Force steers.

## The Movement rule

- A game's Movement rule is chosen on the New Game screen
  (`docs/spec/title-menu.md`), Crossing movement by default, and is
  fixed for that game. It is part of the sim's state and its save
  (`docs/spec/saving.md`).
- Saves from before the Movement rule (save version 9) load as
  Classic movement, the rule they were played under.
- The Demo (`docs/spec/demo-mode.md`) and the Reference runs of
  `docs/spec/movement.md` run under Classic movement.

## Rivers and Crossings

The sim reads rivers as lines and Crossings as points from the vector
geography (`web/src/sim/waterways.ts`). A Crossing is any spot where a
road crosses a river, named or not; fords and bridges are not told
apart (`finding:movement-fords-and-bridges-are-crossing-tiles`). Every
Crossing lies within a tile (16 px) of a river line, and every one has
a road-over-river tile within a tile of it.

## Choosing a Crossing

A Force chooses on its first movement step after it is given a
destination: by an Order, or by taking the next stop on its Default Orders route
(`finding:movement-arrival-pops-next-route-stop`). Every Force with a
destination is treated alike, whether the player ordered it or not.

1. Take the straight segment from the Force's position to its
   destination. If it meets no river line, there is nothing to do.
2. Otherwise take the first river line it meets, from the Force's end,
   skipping any river the Force has already crossed at a Crossing on
   this leg: a Crossing's tile origin can sit a few pixels short of its
   river, such as the Last Bridge's, west of the Hoarwell. If every river
   it meets is crossed, there is nothing to do.
3. The candidates are the Crossings within a tile of that river line,
   measured on each axis (a square, not a circle): the Ford of Bruinen is
   16.3 px from the Bruinen in a straight line but 15.5 px on each axis.
4. A candidate is within reach if the way through it, Force to Crossing
   to destination, is at most `CROSSING_DETOUR_RATIO` (1.5) times the
   direct distance, or it lies within `CROSSING_NEAR_LINE` (64 px, four
   tiles) of the direct segment.
5. Of the candidates within reach, take the one with the shortest way
   through; ties go to the earlier Crossing in `waterways.json`.
6. The chosen Crossing becomes the Force's waypoint, placed on the tile
   origin of the Crossing's tile, so that a step can land on it exactly.
   With none within reach, the Force has no waypoint.

The constants are tuning values, set against the river-crossing legs of
`finding:ai-default-orders-that-cross-rivers`.

## Moving with a waypoint

- A Force with a waypoint steers towards it in place of its destination,
  by the steering of `docs/spec/movement.md`, except that the straight
  step is off: it never takes the one-in-ten step onto a tile rated 10
  or more.
- Reaching the waypoint is tested as arrival is, on landing exactly on
  it at a tile origin, but it is not an arrival: the Force does not rest,
  it is not announced, and nothing that happens on arrival happens. The
  Force records as crossed for this leg every river line within a tile
  of the Crossing (the geography may split a river where it is crossed,
  as it splits the Bruinen at the ford), drops the waypoint and
  chooses again from where it stands.
- A new destination, by an Order or the next route stop, drops the
  waypoint and the record of rivers crossed, and chooses afresh.
- A Force holds at most one waypoint. A leg over several rivers takes
  them one at a time.
- A Force with no waypoint moves exactly as under Classic movement,
  straight step included, so it may wade.

## Changes from the original

Crossing movement changes when some scripted events happen. These are
accepted (ADR-0008):

- Frodo's Default Orders leg from Bree to Rivendell meets the Bruinen
  beside the Ford of Bruinen, so he always crosses at the ford, on the
  tile where the Nazgûl sleep after their tours, and always wakes them.
  Under Classic movement that depends on where he wades. The Council of
  Elrond, held when he reaches Rivendell, may move with it
  (`finding:ai-ring-bearer-crosses-the-bruinen-at-the-nazgul-ford`).
- The Fords of Isen Crossing stands on the tile the Isen Ford tripwire
  tests, so an Evil Force routed over it sets the tripwire's War Events
  as any Force on that tile does. There is no exception for it
  (`finding:mobilisation-isen-ford-tripwire-sits-on-a-crossing`).
- No Crossing lies in the Mordor tripwire's area
  (`finding:mobilisation-mordor-tripwire-holds-no-crossing`).
- No road crosses the Entwash, so Forces still cross it only by wading,
  as Éomer does under Classic movement.

## Tests

- Under Classic movement, every movement and Reference run test is
  unchanged.
- On the S3 map of `docs/spec/movement.md` with a Crossing added, Éomer
  ordered from East Emnet to Edoras crosses the Entwash at the Crossing
  and arrives under Crossing movement, where under Classic movement he
  loops on the bank (`finding:movement-rivers-block-route-finding`). The
  real map has no Crossing on the Entwash, so there Crossing movement
  leaves him as Classic movement does, wading by the straight step.
- On the real map, Frodo's leg from Bree to Rivendell is routed by the
  Last Bridge, then the Ford of Bruinen.
- A Force with a waypoint never stands on a river tile other than a
  Crossing's.
- Reaching a waypoint does not rest the Force or pop its route.
- A save round-trips the Movement rule and a Force's waypoint, and a
  version 9 save loads as Classic movement.
