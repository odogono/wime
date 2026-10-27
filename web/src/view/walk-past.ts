// An Encounter the watched Character passes by on the Animation Level
// walks past the party, mirrored, and off the left edge, while the
// party walks on and the clock stands (docs/spec/encounters.md, "Passing by";
// finding:forces-pass-by-walks-past-on-animation-level).
import type { RosterEntry } from '../sim/index';
import { MAX_FIGURES, figureCount, type Stage } from './animation-level';
import { newFigure, runEntries, type ScriptWorld } from './figure-script';
import { FRAME_MS } from './tick-driver';

// The clock stands for 420 frames while they pass (code+0x0b570).
export const WALK_PAST_MS = 420 * FRAME_MS;

// The Evil side's walk to its line, here a line off the left edge
// (code+0x0b550).
const PASS_ENTRY = 0xb8;
const PASS_LINE = -100;
const PASS_X = 310;
// An odd depth keeps the passers out of the party's walk-off test.
const PASS_DEPTH = 151;

export const walkPast = (
  stage: Stage,
  passer: RosterEntry,
  world: Omit<ScriptWorld, 'laggardLine'>,
  vbl: number
): Stage => {
  if (passer.figure >= 20) {
    return stage;
  }
  const count = Math.min(
    figureCount(passer.strength, passer.figure),
    MAX_FIGURES - stage.figures.length
  );
  const passers = Array.from({ length: count }, (_, k) => ({
    ...runEntries(
      newFigure(
        { ...world, laggardLine: 0 },
        passer.figure,
        0,
        PASS_X + k * 10,
        166 + (k % 5) * 2,
        PASS_DEPTH + (k % 5) * 2,
        passer.index
      ),
      [PASS_ENTRY]
    ),
    flipped: true,
    next: vbl
  }));
  return {
    ...stage,
    figures: [...stage.figures, ...passers],
    lines: { line1: stage.lines?.line1 ?? world.line1, line2: PASS_LINE }
  };
};

// Passers that have walked off the left edge leave the scene.
export const dropPassers = (stage: Stage, party: readonly number[]): Stage =>
  stage.figures.some(f => !party.includes(f.owner) && f.x <= PASS_LINE)
    ? {
        ...stage,
        figures: stage.figures.filter(
          f => party.includes(f.owner) || f.x > PASS_LINE
        )
      }
    : stage;
