import {
  QUARTER_HOURS_PER_DAY,
  QUARTER_HOURS_PER_HOUR,
  type Clock
} from '../sim/index';

// When the game saves itself to the autosave slot (docs/spec/saving.md):
// on each new game hour and each change of Level, but only while the
// game can be restored cleanly. Kept apart from main.ts so the rule is
// tested headlessly.

export interface AutosavePoint {
  // Game hours since day 0.
  hour: number;
  level: string;
}

export interface AutosaveView {
  clock: Clock;
  level: string;
  // Whether nothing on screen would be lost on a restore: no fight,
  // talk or ending under way.
  settled: boolean;
}

export const gameHour = (clock: Clock): number =>
  Math.floor(
    (clock.day * QUARTER_HOURS_PER_DAY + clock.quarterHour) /
      QUARTER_HOURS_PER_HOUR
  );

export const autosavePoint = (view: AutosaveView): AutosavePoint => ({
  hour: gameHour(view.clock),
  level: view.level
});

// Whether to autosave now, given the point of the last autosave (or of
// the game's start). A point passed while unsettled is saved once the
// game settles.
export const autosaveDue = (last: AutosavePoint, view: AutosaveView): boolean =>
  view.settled &&
  (gameHour(view.clock) !== last.hour || view.level !== last.level);
