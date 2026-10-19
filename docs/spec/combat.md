# Combat

How a fight starts, how it is resolved round by round, and what it
leaves behind. Facts cite their Findings (ADR-0004), recovered from
the Reference Build for #45. The reference scenarios are in
`docs/re/combat-reference.md`. The combat window and the announcement
are #47; this Spec covers the rules the sim applies.

Roster entries 1 to 78 are the Good side's and 79 to 151 the Evil
side's (finding:forces-roster-order). The Encounters, entries 152 to
195, are left out until the sim meets them.

## Starting a fight

- A fight is looked for only when a Leader's movement step moves it
  at least one pixel and it lands on a tile origin. Arriving at a
  destination counts. A Leader that doesn't move that tick, or lands
  between tile origins, meets nobody.
  (finding:combat-fight-starts-when-evil-meets-non-evil)
- The mover looks, in roster order, for the first other Leader that
  is moving or resting, has no Leader of its own and stands within
  7 pixels on both axes. An Evil mover looks only at entries 1 to 78,
  any other mover at entries 1 to 151.
- It is a fight when exactly one of the two is Evil (allegiance 0).
  Allegiance 1, unmobilised, counts as non-Evil.
  `provisional`: a match that is not a fight is skipped and the search
  goes on. The original opens a friendly meeting there instead, which
  the sim doesn't model yet.
- Evasion: before the fight, random(100) is drawn. The Good party's
  Force can escape if the roll is below the average of its members'
  evasion byte (byte 29), with 20 added for each member wearing an
  Elven cloak. A member Unit of more than 99 makes the divisor 99. No
  escape is possible when the Good party is a Unit, when the mover
  stands at (1200, 400) or (1744, 1008), or when the Evil party is
  Shelob. An escape ends the search for that tick.
  (finding:combat-evasion-chance)
- When a fight starts, both parties stop (state 2) and the tick sweep
  stops at the mover. Game time stands still until the fight is over,
  then the sweep carries on with the next entry.
  (finding:time-stops-during-a-fight,
  finding:time-clock-advances-after-each-roster-sweep)

## Rows

- The fight is placed at the Good party's position. Every awake
  Leader within 9 pixels of it takes part: Good rows from entries 1
  to 78, Evil rows from 79 to 151. Each Good Leader is followed by its
  followers, recursively, in roster order. An entry whose name matches
  an existing row of its side joins that row. Otherwise it gets a row
  of its own, marked as a follower if it has a Leader. Each side has
  at most 19 rows. (finding:combat-rows-merge-like-named-forces)
- A row's strength is the sum of its entries' current strength. Its
  fighting strength, health, byte 24 and objects are those of its
  first entry. A row that started at strength 1 is a Character for
  wounds and messages.
- Every row starts on Engage (finding:ai-evil-rows-always-engage).

## A round

Below, F is a row's fighting strength, S its current strength, H its
first entry's current health, `bits` a roll of 0 to 7 and `roll(n)` a
roll of 0 to n − 1. Divisions round down.
(finding:combat-blow-formula,
finding:combat-toughness-is-fighting-strength-times-health,
finding:combat-magic-weapons-and-protection)

- A row has a magic weapon if its byte 24 has bit 0, or it carries an
  Ancient sword, Elven blade or Dwarven hammer (objects 3 to 5). It is
  protected if byte 24 has bit 1, or it carries a Gnarled staff or
  Mithril mail (objects 2 and 6). The worn Ring also protects, but
  only on the Animation Level, which the sim doesn't have yet.
- **Blows.** For each row not on Retreat or gone, S is added to its
  side's strength. A row on Withdraw strikes nothing. Any other row
  strikes:
  - with S = 1, `((bits + 1) × F) >> 3`; then, if `roll(100) < 20`, F
    is added and, if `roll(100) < 5`, the blow is multiplied by 16;
  - otherwise `(S × F × bits) >> 4`;
  - plus S × F on Charge.

  The blow joins the side's magic blows if the row has a magic
  weapon, otherwise its ordinary blows. A protected row adds H × F × S
  to its side's magic toughness; any other adds S to its side's head
  count.

- **Magic overflow.** Magic blows beyond the enemy's magic toughness
  move to the ordinary blows. A pool starts equal to each side's
  ordinary blows.
- **Shares**, rows in order, for rows on Charge, Engage or charged.
  T = F × H, two-thirds of that when charged, and at least 1.
  - A protected row first takes the enemy's magic blows: `n = magic /
T`, up to S. Then it takes the pool at a quarter strength,
    `pool / 4T`, up to S in all. A Character still standing is wounded
    by `magic / F`, if any magic is left. Otherwise, one time in three,
    it takes 1 point if the enemy's ordinary blows exceed 4F, which
    then lose 4F.
  - An unprotected row takes `ordinary × S / (T × own head count)`,
    no more than the pool allows, and up to S.
- **Left over**, rows in order, unprotected rows on Charge, Engage or
  charged, while the enemy's pool lasts. F′ is F, or 4F / 3 when
  charged, and at least 1. T = max(F′ × H, 1). The row loses
  `pool / T` members, up to S. A Character still standing is wounded by
  `pool / F′`.
- A wound that would take all of a Character's health kills it
  instead. Wounds are written to the roster at once. Each loss comes
  off the row and its side, and a row at 0 is gone. Then the Good rows'
  options move on: charged becomes Engage, Charge becomes charged, and
  if a Good row was wiped out this round, Withdraw becomes Engage.
  (finding:combat-option-charge-mechanics,
  finding:combat-option-withdraw-mechanics)
- Rounds repeat until a side's strength is 0. The side with strength
  left wins. (finding:combat-rounds-until-a-side-is-empty)

The random numbers come from the sim's seeded RNG (ADR-0002). The
original also mixes the frame count into the 0 to 7 roll
(finding:combat-rolls-mix-in-the-frame-counter), so we match its
distributions, not single fights. Nothing about the Place or terrain
enters the round (finding:combat-no-place-or-terrain-modifier).

## Options

- The player sets an option for a Good row only. A row on Retreat or
  gone can't change. Withdraw and Retreat are refused unless at least
  two Good rows are on Charge or Engage with strength and health left.
  (finding:combat-option-retreat-and-the-last-fighter)
- Evil rows stay on Engage (finding:ai-evil-rows-always-engage).
- An ignored fight is fought to the end at once with every row on
  Engage (finding:combat-ignored-fight-resolved-at-once).

## The end of a fight

- Each row's loss, its starting strength less its strength now, is
  taken in roster order. The scan starts from the row's first entry
  and covers awake entries up to 151 with the same name whose top
  Leader stands within 8 pixels of the fight. Each gives up as much
  strength as it has.
  (finding:combat-losses-taken-when-the-fight-ends)
- An entry left with no strength or no health is dead: its strength
  and state become 0, and nothing else changes. Every other entry the
  scan reached is set moving (state 1). Every entry of an Evil row is
  healed to its maximum health.
  (finding:combat-evil-survivors-healed)
- Then each awake Good entry whose Leader died follows the first
  living Leader up its chain. If there is none it becomes a Leader. It
  takes the dead top Leader's position, destination and facing, and
  its Default Orders are emptied. It takes the dead Leader's allegiance
  if its own is below 4.
  (finding:forces-followers-of-a-dead-leader)

## Left out

- Objects of the dead and the Ring passing to a new bearer
  (finding:objects-dead-drop-their-objects,
  finding:objects-ring-passes-after-a-fight): milestone 7.
- The Stronghold and Barad-dûr checks after a fight: #50.
- The Ring put on when its bearer is wounded
  (finding:objects-ring-put-on-when-wounded) and fights fought on the
  Animation Level: milestone 6.
- Encounters and friendly meetings.

## The announcement and the combat window

These are the view's, on the Campaign Level (#47). Times are the
original's 50 Hz frames.

- When a fight starts, a window at (56, 5) names it: "<Place> is being
  attacked by <enemy>." at a Place that announces attacks, otherwise
  "<Leader> is attacked by <enemy>.", or "… are attacked by …" for a
  Unit. A Unit is named with its head count. It offers "Go there" and
  "Ignore it". Unanswered, it presses "Ignore it" after 720 frames.
  (finding:ui-fight-announcement,
  finding:combat-unanswered-announcement-ignores-the-fight)
- "Ignore it" fights the fight out at once. A message box at (10, 5)
  gives the result, then one box per dead Character: "has died in
  combat.", or "has been driven from the field." for a Nazgûl. Each
  stays 200 frames or until a press. Time runs again while the last
  is up. (finding:combat-ignored-fight-resolved-at-once)
- "Go there" brings the fight into view and opens the combat window
  at (6, 0), 272 pixels wide. It shows the option headers, a row per
  combat row, and one message line. The opening "<A> and <B> move
  grimly into battle." is followed by a 300-frame pause for orders.
  Each round's loss messages then stay at least 180 frames each, and
  rounds with no losses run at once. The result stays 300 frames, then
  the fight ends. (finding:ui-combat-window-layout,
  finding:combat-round-pacing, finding:combat-casualty-messages)
- A Good row's four buttons set its option. The marked button is its
  option; a charged or gone row has none. Names are white when hale,
  red when wounded and grey when dead or destroyed, standing in for
  the original's black, red and grey (finding:combat-name-colours).
- `provisional`: a fight whose Good side is only Characters is fought
  in this window too, until the Animation Level exists
  (finding:combat-where-a-fight-is-fought).
