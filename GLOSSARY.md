# War in Middle Earth

A faithful browser reimplementation of the 1988 Melbourne House / Synergistic game _War in Middle Earth_, using the Amiga v1.0 release as the canonical reference.

## Levels

**Level**:
One of the three views onto the single game world. The Full Map Level and the Campaign Level are the far and near bands of one continuously zoomable map; the Animation Level is a separate view. The player moves between them at any time.
_Avoid_: Zoom, view mode, screen

**Full Map Level**:
The far zoom band of the map, showing the whole of Middle Earth, where Forces appear as dots: blue for Good, red for Evil, green for Neutral.
_Avoid_: Overview map, world map, strategic map

**Campaign Level**:
The near zoom band of the map, showing part of Middle Earth in detail, where Characters appear as figures and Units as badges. Most orders are given here.
_Avoid_: Tile map, local map

**Animation Level**:
A detailed view of a single place, where each individual is animated against a background.
_Avoid_: Scene, close-up

**Classic map**:
The map drawn as the original draws it, from its tiles and its full-map picture, with its own sprites and dots for Forces. The default.
_Avoid_: Retro mode, pixel map

**Atlas map**:
The port's own drawing of the map, one ink-on-parchment map in the manner of Tolkien's, with Forces drawn in their own style. It changes how the world is shown, never the rules.
_Avoid_: Vector map, HD mode, Tolkien map

**Emblem**:
A Force's picture on the Atlas map when zoomed in: a silhouette of its Leader's figure on a banner for a Character, or a shield of its Nation and Unit Type for a Unit.
_Avoid_: Figure, sprite, icon (a figure is the Classic map's sprite)

**Compact marker**:
A Force's picture on the Atlas map at middle zoom: its Emblem's simplified outline in its Side colour.
_Avoid_: Badge

**Dot**:
A Force's picture when zoomed far out: a small dot in its Side colour.

**Aggregate**:
On the Atlas map, one mark standing for several Forces whose Dots would overlap, with their number beside it.
_Avoid_: Cluster, stack

## Forces

**Character**:
A named individual, such as Frodo or Aragorn. A Character can be wounded and can die.
_Avoid_: Hero, person

**Unit**:
An indivisible body of troops, such as Rohan cavalry, ranging from about a hundred to several thousand strong. A Unit is not wounded; it is only destroyed.
_Avoid_: Army, troop, regiment

**Force**:
Anything that moves on the map as one group: one or more Characters and/or Units under a leader whom the others follow. A Force splits when one of its Characters is given an Order; that Character's followers go with it. A Unit never splits.
_Avoid_: Party, group, stack, army

**Leader**:
The Character or Unit that the other members of a Force follow.
_Avoid_: Commander

**Ring-bearer**:
The Character carrying the One Ring. If the Ring-bearer dies, another Character becomes Ring-bearer.
_Avoid_: Ringbearer, carrier

**Side**:
The allegiance of a Force: Good (controlled by the player), Evil, or Neutral (not yet committed to the war).
_Avoid_: Team, player

**Faction**:
A distinct power within a Side, such as Sauron or Saruman on the Evil Side.

**Nation**:
The people a Unit comes from, shown by the design of its shield, such as Rohan, Gondor (Dol Amroth) or Dunland. A Nation is not the power that controls it; that is its Faction.
_Avoid_: Country, origin, realm

**Unit Type**:
The kind of troops a Unit is made of, shown by the weapon on its shield, such as cavalry, infantry, light infantry or Orcs.
_Avoid_: Class, troop type

**Mobilisation**:
A Neutral Nation committing its Forces to the Good Side and the player's command, when shown its Token or when a War Event or the approach of the Ring-bearer or Gandalf sets them going. Being attacked never mobilises a Force.
_Avoid_: Activation, recruitment

## Map

**Terrain Region**:
An area of the map with a single kind of ground, such as forest, marsh or mountain. The kind of ground sets how fast Forces cross it, or whether they can cross it at all.
_Avoid_: Tile, zone, area

**Place**:
A named point on the map, such as Hobbiton or Cirith Ungol. Every Place has a kind, such as a small town, a ruin or a fortress.
_Avoid_: Location, site, town

**Stronghold**:
One of the five major Good Places (the Hornburg, Edoras, Minas Tirith, Lórien and Thranduil's Palace). Each stands or falls with one named Garrison, and losing any three loses the game.
_Avoid_: Capital, base

**Garrison**:
A Unit that starts at a Place and stays there unless the player orders it away or its Leader moves. Some start asleep until a War Event wakes them. A Place may have several.
_Avoid_: Defenders, guard, fort troops

## Play

**Order**:
An instruction given to a Force on the Campaign Level, such as moving to a destination or following a Leader.
_Avoid_: Command, move

**Encounter**:
A meeting with another Character on the map, which the player may go to on the Animation Level or ignore.
_Avoid_: Event, meeting

**Token**:
The object that mobilises a particular Nation when presented to its ruler, such as the Red Arrow for Rohan.
_Avoid_: Key item, quest item

**Default Orders**:
The course of action each Character starts with, which the Character follows until given an Order.
_Avoid_: Script, AI path

**War Event**:
One of the five turning points that set later stages of the war going, such as Saruman's army marching.
_Avoid_: Trigger, stage, phase

**Council of Elrond**:
The one-off event when the Ring-bearer's Force reaches Rivendell with Gandalf there: the Fellowship is formed under Gandalf, the calendar moves on and the Nazgûl are put to sleep.
_Avoid_: Rivendell event, council meeting

**Game Speed**:
How fast game time passes in real time: Normal, Hasty or Very Hasty. Game Speed never changes the rules.
_Avoid_: Difficulty, tempo

**Galadriel's Mirror**:
The window the eye opens on the Full Map Level, listing every Force on the move: Good Forces and where they are going on the left, Evil Forces on the right.
_Avoid_: Status window, pool, overview list

**Archive**:
The single saved game, kept in one file and saved or restored through the scroll on the Full Map Level.
_Avoid_: Save slot, save file

**Boot sequence**:
What the game shows from start-up until the first Animation Level: the Melbourne House screen, the Synergistic screen, the title screen, the Credits and the Ring verse, with Title playing.
_Avoid_: Intro, splash screens, attract mode

**Title screen**:
The full-screen picture of the boot sequence, ATitle.res IMAG 72, with the game's logo, IMAG 73, drawn over it.
_Avoid_: Splash screen, menu

**Credits**:
The names of the people who made the game, scrolled up over the title screen during the boot sequence.
_Avoid_: Credit roll, attributions

**Ring verse**:
The verse of the Rings of Power, shown in a window on a black screen at the end of the boot sequence.
_Avoid_: Poem, Ring poem, inscription

**Gandalf's letter**:
The note from Gandalf to Frodo shown once, in a window over the first Animation Level.
_Avoid_: Intro text, Gandalf's message

**Demo**:
A recorded winning campaign that the game plays by itself, from New Game to its ending.
_Avoid_: Attract mode, replay, demo script

**Demo mode**:
The state of the game while a Demo plays: the player watches, and never gives Orders or touches a save.
_Avoid_: Attract mode, autoplay

## Project

**Reference Build**:
The release of the original game that settles questions of how it worked: the Amiga v1.0 release. Other versions may be consulted but are never authoritative.
_Avoid_: Original, master copy

**Reference run**:
A recorded run of the Reference Build in an emulator, set up to observe one behaviour and cited as evidence by Findings.
_Avoid_: Scenario, test case

**Scenario**:
A playable game: the starting forces, Places and map, and the rules that run them. The game the original shipped with is one Scenario.
_Avoid_: Mod, campaign, Level

**Setup**:
Where a Scenario's game starts: the objects lying on the map, the Encounter figures' areas and first days, and the Nazgûl's starting positions.
_Avoid_: Start, layout, map seed

**Classic Setup**:
The Setup the original shipped with, the same in every game.
_Avoid_: Default setup, original layout

**Shuffled Setup**:
A Setup drawn from a Setup seed, within limits the Scenario sets. The rules are unchanged.
_Avoid_: Random map, randomised game

**Scenario Script**:
The code that gives a Scenario its rules.
_Avoid_: Script, mod

**Finding**:
A single recorded fact about how the original game worked, with its sources and how certain it is.
_Avoid_: Note, discovery, research fact

**Lesson**:
A Finding about how the analysis itself went, such as a technique that worked or a dead end.
_Avoid_: Retrospective, learning

**Spec**:
A statement of what the reimplementation must do, citing the Findings it rests on.
_Avoid_: Requirement doc, design doc

**Debug view**:
An overlay on the Campaign Level that shows the game's hidden workings, such as terrain or where Forces are heading, for those developing the port. Not part of the game as played.
_Avoid_: Cheat, overlay mode
