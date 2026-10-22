# How the game AI works

This guide describes the Amiga v1.0 Reference Build, using the repository's
recorded Findings. It explains destination choices, movement, mobilisation and
combat, with particular attention to the Nazgûl. The final section points to the
browser port and identifies gaps. This is an overview of existing evidence, not
a new Spec; the linked Findings retain their sources and confidence levels.

## What makes the computer's decisions

The behaviour recovered so far combines **Default Orders, one-off triggers,
local movement rules and special event rules**. A Force has a current destination;
its Default Orders supply subsequent destinations. Triggers determine when some
Forces wake or mobilise. Movement rules determine how they get there, and nearby
opponents can start a fight. These mechanisms explain much of what looks like
planning during play. The existing evidence does not establish a general system
that continually chooses strategic targets or tracks the Ring-bearer's route.

Sources: [Default Orders](findings/ai-default-orders-are-place-queues.md),
[triggers](findings/ai-trigger-conditions.md),
[steering](findings/movement-greedy-tile-steering.md),
[fight detection](findings/combat-fight-starts-when-evil-meets-non-evil.md).

## How the Nazgûl choose where to go

### Their initial search follows preset journeys

Each Nazgûl has its own tour through the Shire, Bree and Weathertop, ending at the
Ford of Bruinen. These tours come from the same Default Orders table used by
other Forces. A route is a queue of up to eight Places; reaching a destination
takes the next Place off the queue and makes it the new destination. It consumes
the queue rather than automatically repeating the tour.

Consequently, a Nazgûl appearing along the Hobbits' route is not, by itself,
evidence that it detected them from afar and changed course. The recovered
mechanism gives it a journey through the same region. Whether it actually
intercepts the Hobbits also depends on movement, rest and close-range fight
detection. No adaptive long-distance pursuit rule is established by the Findings
cited here.

Sources: [the route table and Nazgûl tours](findings/ai-default-orders-are-place-queues.md),
[arrival and the next stop](findings/movement-arrival-pops-next-route-stop.md).

### Close contact starts a fight

After a Leader moves at least one pixel and lands on a tile origin, the game
searches for another eligible Leader within **7 Campaign Level pixels on each
axis**. One Evil and one non-Evil Leader make an opposing pair. The search uses
roster order, so it is not choosing the most valuable or weakest nearby target.
The Good Force may evade under the separate evasion rules.

This gives the Nazgûl a way to attack the Ring-bearer's Force when their journeys
bring them together, without requiring the Ring-bearer to be their destination.
A Reference run recorded the 4th Nazgûl attacking Frodo's Force during its second
rest on the road to Bree.

Sources: [fight detection](findings/combat-fight-starts-when-evil-meets-non-evil.md),
[evasion](findings/combat-evasion-chance.md),
[Frodo's recorded journey](spec/movement.md).

### They can hide at the Ford of Bruinen

The hiding Finding identifies a special arrival rule at the Ford of Bruinen:
a Nazgûl is put to sleep and given the Ring-bearer proximity trigger. Sleeping
Forces disappear from both the Full Map Level and Campaign Level and do not
participate in fights.

The trigger wakes the Nazgûl when the Leader of the Ring-bearer's Force is within
**9 pixels on each axis**. This is a square proximity test, not a distance along
roads. Waking consumes the trigger and takes a queued destination if one remains;
it does not, by itself, set the Ring-bearer's current position as a pursuit target.

Sources: [Nazgûl hiding](findings/forces-nazgul-hide-at-ford-of-bruinen.md),
[trigger distances](findings/ai-trigger-distances-are-square.md),
[waking effects](findings/ai-trigger-what-waking-changes.md),
[sleeping Forces and combat](findings/combat-sleeping-leaders-take-no-part-in-a-fight.md).

### Capturing the Ring replaces their destinations

When an Evil winner takes the Ring after a fight, the new Ring-bearer leaves its
Leader, loses its Default Orders and receives **Barad-dûr** as its destination.
This can be a Character or a Unit; the rule is not exclusive to Nazgûl.

Every other awake Nazgûl not carrying the Ring also loses its Default Orders and
receives a randomly chosen destination: Dol Guldur with probability 1/4, the
Morannon with probability 1/4, or Minas Morgul with probability 1/2. This is a
specific response to Ring capture, not a general target-selection routine.

An Evil Leader arriving at Barad-dûr with the Ring loses the game for the player.
The manual mentions Orthanc as an alternative, but the recovered ending check
only uses Barad-dûr. The bearer can be intercepted before it arrives.

Sources: [Ring transfer and Nazgûl destinations](findings/objects-ring-taken-by-last-awake-winner.md),
[Barad-dûr ending](findings/objects-ring-at-barad-dur-loses.md).

### The Council and defeat can remove them from play

The Council of Elrond puts all nine Nazgûl to sleep and clears their triggers.
They therefore do not wake through the ordinary trigger system afterwards.
There is a separately recorded special case involving the 3rd Nazgûl when an
Evil Encounter wins the Ring; this should not be generalised into a return
mechanism for all nine.

The manual says defeated Nazgûl reappear in Mordor. The repository has not found
a general revival mechanism in the Reference Build: combat records a defeated
Nazgûl with zero strength, which an ordinary trigger cannot wake. That absence
is recorded as provisional, rather than proof that every possible return path
has been ruled out.

Sources: [Council sleep](findings/ai-council-puts-the-nazgul-to-sleep.md),
[exceptional waking rules](findings/ai-what-wakes-an-entry.md),
[revival investigation](findings/forces-nazgul-revival-not-found.md).

## How other Forces choose destinations

Good Characters also start with Default Orders. For example, Frodo starts heading
for Green Hills, with Woodhall, Buckland, Bombadil's House, Bree and Rivendell
queued. Aragorn's queue runs through Midgewater Marsh, Weathertop, the Last Bridge
and the Ford of Bruinen to Rivendell. Player Orders replace this automatic
itinerary for the ordered entry.

Evil Units likewise have predetermined routes. Their queues lead towards Minas
Tirith, Edoras, the Hornburg, Lórien and Thranduil's Palace. One Wainrider route
runs through Dale and Rivendell to Hobbiton. These destinations are present in
the starting data; the route-table evidence does not show them being selected
by comparing the current defences of those Places.

Sources: [Default Orders](findings/ai-default-orders.md),
[route examples](findings/ai-default-orders-are-place-queues.md),
[player Orders](spec/movement.md#orders).

## When Forces start moving

A Force's trigger can depend on the nearby Ring-bearer, nearby Gandalf, a War
Event, or a delay after a War Event. Ring-bearer proximity uses 9 pixels on each
axis; Gandalf proximity uses 4. Delayed triggers wait for internal hour 8 once
the required days have elapsed. A successful trigger wakes a living sleeping
entry, mobilises it if appropriate, takes its first queued destination if
available, and clears itself.

The war also has scheduled and player-dependent turning points. Saruman's march
is scheduled for day 149 and the Dark Lord's for day 169. A non-Evil Leader
reaching the south-eastern region at or beyond (1664, 1008) can start the latter
early. An Evil Leader reaching the Isen Ford sets the Gondor and Rohan events.
Using the Palantír can also bring forward the Dark Lord's event.

These are concrete conditions rather than a strategic assessment of whether it
is a good time to attack. Their exact timing matters: the daily check runs on
the Campaign Level, at internal hour 8 (displayed as 9 a.m.), and the scheduled
days are equality checks. Missing that check on the Animation Level can miss
the calendar trigger. Being attacked does not itself mobilise a Force.

Sources: [trigger rules](findings/ai-trigger-conditions.md),
[delayed triggers](findings/ai-delayed-triggers-wait-for-hour-8.md),
[War Events](spec/war-events.md),
[Palantír](findings/objects-palantir-vision-or-tip.md),
[Campaign Level restriction](findings/ai-war-events-checked-only-on-campaign-level.md),
[attacks and mobilisation](findings/mobilisation-attack-does-not-mobilise.md).

## How a Force travels to its destination

Choosing a destination and finding a way there are separate operations. At a
tile origin, the movement code scores the eight neighbouring tiles using terrain
and how closely each direction points towards the destination. It favours better
terrain and forward progress, with a special penalty for reversing in some
facings. One time in ten it instead takes the desired direction directly if
the terrain ahead is rated at least 10.

There is no search beyond those neighbours. A Force can follow a riverbank,
loop or take an awkward route while retaining the same destination. That is a
consequence of the local steering rule, not necessarily a new decision about
where to go.

The Leader determines a Force's pace and stamina use. Moving normally consumes
stamina; rest restores it, and setting off again includes a random check during
a morning window. Arrival also puts a Force into its resting state before the
next leg. Thus preset destinations do not imply identical arrival times in
every run. The Nazgûl have maximum stamina 255, which exempts them from
movement stamina costs; they can still pause at arrivals.

Sources: [local steering](findings/movement-greedy-tile-steering.md),
[Leader's pace](findings/movement-mixed-force-at-leader-pace.md),
[stamina and rest](findings/movement-stamina-and-rest.md),
[arrival](findings/movement-arrival-pops-next-route-stop.md).

## What Evil chooses during combat

The recovered combat code gives every Evil combat row **Engage**, and leaves it
there until destroyed. It does not choose Charge, Withdraw or Retreat in response
to the battle. The manual's suggestion that intelligent Evil Characters such as
the Nazgûl might retreat is not borne out by this code.

Random combat rolls affect the outcome, but randomness in damage is distinct
from choosing a tactic. Ignored fights resolve with all rows on Engage.

Sources: [Evil options](findings/ai-evil-rows-always-engage.md),
[manual's retreat claim](findings/ai-evil-units-rarely-retreat.md),
[ignored fights](findings/combat-ignored-fight-resolved-at-once.md).

## Where this lives in the browser port

The implementation distributes these rules across the simulation:

- [movement.ts](../web/src/sim/movement.ts): route queues, local steering,
  stamina, rest and player Orders.
- [wake.ts](../web/src/sim/wake.ts): proximity and event triggers.
- [war-events.ts](../web/src/sim/war-events.ts): the daily event rules and
  movement tripwires.
- [combat.ts](../web/src/sim/combat.ts): fight detection and combat options.
- [ring.ts](../web/src/sim/ring.ts): Ring transfer, Barad-dûr destination and
  the other Nazgûl's random destinations.
- [council.ts](../web/src/sim/council.ts): the Council's changes to the roster,
  including putting the Nazgûl to sleep.

Two limitations are visible in the current implementation. The arrival function
in `movement.ts` applies ordinary resting and queue advancement without the
special Ford hiding rule. The Evil Encounter branch in `ring.ts` can give the
Ring to an already-awake 3rd Nazgûl, but does not itself wake or revive him.
These are implementation gaps, not alternate explanations of the original's AI.

The port uses a seeded random-number generator and aims to reproduce rules and
distributions, rather than the original's exact random sequence. See
[ADR-0002](adr/0002-behavioural-fidelity-headless-sim.md).
