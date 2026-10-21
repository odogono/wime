# Objects

What Characters carry, how objects are put down, taken and used, how
the Tokens mobilise their rulers, and what the Palantír does. Facts
cite their Findings (ADR-0004), recovered from the Reference Build for
#102. The Ring's passing and the end of the game belong to
`docs/spec/winning-and-losing.md` (#101).

## The objects

- There are 16 objects, numbered 0 to 15: the Ring, a Dwarven Ring, a
  Gnarled staff, an Ancient sword, an Elven blade, a Dwarven hammer,
  Mithril mail, a Palantir, an Elven cloak, a blue potion, a black
  flask, a glowing vial, the Red Arrow, a coil of rope, a sceptre and
  a silver orb. These names, with their articles, are the ones shown.
  (finding:objects-carried-as-a-bitmask)
- Each roster entry carries a set of objects, one bit per object, so a
  Character holds at most one of each. At the start Frodo carries the
  Ring and an Elven blade, Aragorn an Ancient sword, and nobody else
  anything. (finding:objects-carried-as-a-bitmask,
  finding:objects-ring-starts-with-frodo)
- Objects lying on the map are a table of 30 slots, each an object
  number and an x and y in Campaign Level pixels; 25 are filled at the
  start, as read by `tools/extract-starting-state.ts`. A slot whose x
  is 0 is free. (finding:objects-starting-placements)
- Each object has a kind of use, a usable flag and a used-up flag:
  (finding:objects-use-table)

  | Object                                                | Usable | Used up when it works |
  | ----------------------------------------------------- | ------ | --------------------- |
  | the Ring                                              | no¹    | no                    |
  | a Dwarven Ring, the Red Arrow, a silver orb           | yes    | yes                   |
  | a sceptre                                             | yes    | no                    |
  | a Palantir                                            | yes    | no                    |
  | a blue potion, a black flask, a glowing vial          | yes    | yes                   |
  | a coil of rope                                        | yes    | no                    |
  | a Gnarled staff, Mithril mail, the weapons, the cloak | no     | no                    |

  ¹ The Ring's record is marked usable, but the Use list never offers
  object 0.

- The weapons, the staff, the mail and the cloak work by being
  carried, in fights and in the evasion roll; see `docs/spec/combat.md`.
  (finding:combat-magic-weapons-and-protection,
  finding:combat-evasion-chance)

## Put Down, Take and Use

Objects are handled only on the Animation Level, through the
provisions icon, which offers "Put down an object", "Take an object"
and "Use an object". (finding:objects-handled-on-animation-level)

### The windows

- The sack opens a box at (168, 5), 112 by 68, headed "Would <name>
  like to..." in colour 8, with the framed buttons "Put down an
  object", "Take an object" and "Use an object". It is ignored during
  a fight. (finding:ui-provisions-window)
- The chosen Character is the last figure clicked, if it is in the
  Force on screen and awake, else the first awake member. With none,
  or a Unit, "Please select an active member of the party." is shown
  instead. The Character the sack picks becomes the selected one
  (docs/spec/animation-level.md, "Selecting and status").
  (finding:ui-provisions-chosen-character)
- A list is a box at (112, 5), 176 wide and 28 plus 10 for each line
  deep, its heading in colour 8 and one unframed line per object.
  (finding:ui-object-list-window)
- A box with buttons stops the clock and the Force's figures, and
  closes by itself after 1,020 frames; there is no Cancel. A message
  without buttons lasts 200 frames and lets time run.
  (finding:ui-provisions-window, finding:ui-object-list-empty-messages,
  finding:objects-use-message-boxes) `provisional`: a press off the
  buttons closes the box with its default; in the original it does
  nothing (finding:ui-message-box-presses-off-the-buttons, #184).
- Objects lying exactly where the watched Character stands are drawn
  when each scene is built, at most six: BScene.res IMAG 50 plus the
  object, its top left at x 200 plus up to 39 and y 165, at depth 0x99
  among the figures
  (finding:objects-on-the-ground-drawn-when-the-scene-is-built,
  finding:objects-lying-on-the-ground-are-pictures).
- Take sends the Character's figure walking to the picture (script
  entry 0xd4): its message shows as it sets off, the picture goes when
  it stoops, and it walks back and turns to its old facing
  (finding:objects-take-is-a-walk-to-the-picture-and-back).
- Put Down makes the figure stoop where it stands (entry 0xde): the
  picture appears at its feet, 2 pixels left of it at y 161 and behind
  every figure, and only then the message shows
  (finding:objects-put-down-is-a-stoop-in-place). Without a figure on
  screen, or for Take without the picture, the message shows at once.
- `provisional`: these were read from the code, not played. Clicking
  an object's picture to see its name is not built.

The **chosen** Character is the party member selected; the
**position** is the watched Character's position, the Force on
screen. Each choice opens a list in object order.
(finding:objects-provisions-lists)

### Put Down

- Lists objects 1 to 15 the chosen Character carries, headed "Select
  the object for <name> to drop:". The Ring is never listed. With
  nothing to list: "<name> is unwilling to part with anything."
  (finding:objects-provisions-lists)
- Putting an object down writes it into the first free slot, at the
  position, and removes it from the chosen Character. With no free
  slot the object is lost. Once the figure has put it down, "<name>
  puts down <object>." is shown.
  (finding:objects-put-down-message-after-the-animation)

### Take

- Lists the slots whose x and y both equal the position, at most
  seven, headed "Select the object for <name> to get:". With none:
  "There are no objects here." (finding:objects-provisions-lists)
- Taking an object frees the first slot holding it at the position
  (its x becomes 0) and adds it to the chosen Character, with
  "<name> goes to pick up <object>." Taking an object the Character
  already carries loses it. (finding:objects-take-from-the-ground)
- Taking the Ring makes the chosen Character the Ring-bearer.
  (finding:objects-take-from-the-ground)

### Use

- Lists the usable objects 1 to 15 the chosen Character carries,
  headed "Select the object for <name> to use:". With none: "<name>
  has nothing which is 'usable'." (finding:objects-provisions-lists)
- A used-up object is removed from the chosen Character once its
  effect works, and is not placed anywhere. A Token that fails is
  kept. (finding:objects-use-table)

| Object         | Effect                                                                                                                                               | Finding                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| a blue potion  | "<name> feels much better." if health is below maximum, else "<name> feels no effect."; health is set to maximum either way, and the potion used up. | objects-draughts-heal-and-strengthen |
| a black flask  | Fighting strength +1, "<name> feels an odd strength flow into his limbs!"                                                                            | objects-draughts-heal-and-strengthen |
| a glowing vial | Maximum health +1 and health set to it, "<name> has a growing feeling of exceptional health!"                                                        | objects-draughts-heal-and-strengthen |
| a coil of rope | "There is no need to use the rope here." Nothing else.                                                                                               | objects-rope-has-no-use              |
| a Palantir     | See [The Palantír](#the-palantír).                                                                                                                   | objects-palantir-vision-or-tip       |
| the Tokens     | See [Tokens](#tokens).                                                                                                                               | mobilisation-token-shown-to-ruler    |

The flask and the vial have no cap.
(finding:objects-draughts-heal-and-strengthen)

## Tokens

A Token works when used while the position is exactly the ruler's
position and the ruler is awake. (finding:mobilisation-token-shown-to-ruler)

| Token          | Ruler          | Also needs          | Also mobilises               |
| -------------- | -------------- | ------------------- | ---------------------------- |
| a Dwarven Ring | Dáin, entry 17 |                     |                              |
| the Red Arrow  | Théoden, 26    |                     |                              |
| a sceptre      | Denethor, 32   | his allegiance is 1 |                              |
| a silver orb   | Thranduil, 22  |                     | the elves of entry 62, woken |

- On success the ruler's allegiance becomes 99, mobilised, and his
  trigger is cleared; the Token's success text is shown (BScene CSTR
  38, 40, 42 or 44). The silver orb also sets entry 62 to state 1,
  allegiance 99 and no trigger. No other entry changes.
  (finding:mobilisation-token-shown-to-ruler)
- Otherwise its hint is shown (CSTR 39, 41, 43 or 45) and the Token
  kept. (finding:mobilisation-token-shown-to-ruler)
- The rest of Rohan and Gondor follow through the War Events:
  Théoden mobilised sets event 5 and Denethor event 3 at the next
  daily check; see `docs/spec/war-events.md`. Nothing follows Dáin or
  Thranduil. (finding:ai-war-events,
  finding:mobilisation-token-shown-to-ruler)
- Being attacked never mobilises a Nation; only the Tokens, the
  triggers and the War Events do.
  (finding:mobilisation-attack-does-not-mobilise,
  finding:mobilisation-evil-at-the-fords-of-isen)

## The Palantír

- Using it shows "Looking deep into the crystal, <name> sees a
  vision:" and draws a random number below 100.
  (finding:objects-palantir-vision-or-tip)
- Above 30, with War Event 7 not yet set, it sets event 7 with the
  day, silently, and shows the vision of the nine, BScene CSTR 37.
  This is the early War Event: the next daily check brings events 3,
  4 and 6 and "Saruman's army is on the march!", but never "The Dark
  Lord's armies march forth!". (finding:objects-palantir-vision-or-tip,
  finding:ai-war-events-set-once,
  finding:mobilisation-tripwires-follow-arrival)
- Otherwise it shows one of the advisors' tips not yet given, as an
  advisor would. (finding:objects-palantir-vision-or-tip,
  finding:ui-advisors-share-advice)
- The Palantír is never used up. (finding:objects-palantir-vision-or-tip)

## Dropping on death

- A Character killed in a fight leaves every object it carried, the
  Ring included, in free slots at the place of the fight.
  (finding:objects-dead-drop-their-objects)
- The dead entry's own objects are not cleared.
  (finding:objects-dead-drop-their-objects)

## Saving

- The carried objects, the placement table and the Ring-bearer are
  part of the saved game, which is a copy of the roster and the tables
  after it. (finding:data-formats-archive-dat-is-roster-dump)
