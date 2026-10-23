# Demo mode

The game playing itself: a **Demo** replays one of three recorded
campaigns, fellowship, muster and defensive, from a New Game to its
ending (GLOSSARY.md). The original has no Demo mode
(`finding:ui-original-has-no-demo-mode`). It is the port's own, built on
the Demo driver in `web/src/sim/demo.ts`, which the headless replay in
`tools/strategy.ts` runs too (#244).

## Starting a Demo

- **Idle:** after 60 seconds with no input at the main title menu
  (docs/spec/title-menu.md). Any key, click or mouse movement starts the
  wait again. The Load list, the new-game confirmation and a load's
  message pause it. The boot sequence never starts a Demo.
- **Chosen:** the title menu's Demo entry.
- Either way the Demo is picked at random, at even odds, from the
  three, never the one that played last in the session.

## The opening

- A Demo opens as a New Game does, from its own seed: the Animation
  Level, the Hobbits and Gandalf's letter.
- The letter closes by itself 15 seconds after it opens. In a chosen
  Demo a key or a click closes it sooner.
- The first time the party walks off the edge of the opening scene, the
  Demo goes up to the Campaign Level and watches nobody. Only the first
  time: later scenes follow the watched party as in play.

## How a Demo plays

- The Demo's run owns the game. Each tick is the headless replay's
  step: its Orders, its answers to meetings and its fights. The view
  shows a copy, and its fight, meeting and Council windows play out at
  their usual pace, read-only, with the outcome the Demo took.
- Nothing can be ordered: no arrow, no Provisions, no combat options,
  no answers to boxes, no Archive.
- A small DEMO label, in the game's font on parchment, stays in the
  bottom right corner throughout, on every Level and the ending.
- A Demo never reads or writes a save, the autosave included. After it,
  Resume offers the player's own save as before.

## The two kinds

|                   | Idle                                                   | Chosen                                                                                                 |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Speed             | Very Hasty                                             | starts at Very Hasty; the Game Speed window offers Normal, Hasty and Very Hasty                        |
| After the opening | the Campaign Level only, the camera on the Ring-bearer | the camera follows the Ring-bearer until the player scrolls or takes up the magnifying glass, for good |
| Levels            | none: input leaves                                     | the magnifying glass and the Level icons and keys work                                                 |
| Leaving           | any key or click: the title menu, the idle wait anew   | only the in-game menu, opened by Escape, with Resume and Return to title; Return to title asks nothing |
| The ending        | the ending screen, then the title after 10 s or a key  | the ending pages as in play, then a menu with Return to title alone                                    |

- Leaving a Demo goes to the title menu without the boot sequence, and
  the Game Speed returns to what it was before the Demo.

## Checking the Demos

CI has none of the original's data, so it cannot replay the Demos. Before
a release, with the assets exported, `bun test tools/strategy.test.ts`
replays each Demo headless, and `web/src/view/demo-mode.test.ts` replays
each through the view's loop and checks it ends as the headless replay
does (docs/agents/commits.md, "Releasing").
