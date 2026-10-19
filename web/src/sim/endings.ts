// How the game ends after a fight (docs/spec/combat.md, "Endings").
// At the end of every fight the original counts the Strongholds whose
// Garrison is destroyed, and loses at three
// (finding:places-stronghold-falls-with-its-garrison); then it wins if
// the Garrison of Barad-dûr is destroyed
// (finding:places-destroying-barad-dur-garrison-wins).

import type { RosterEntry } from './starting-state';

// 'lost-strongholds' and 'won-barad-dur' are the two endings a fight
// can bring; the Ring's endings come with the objects milestone.
export type Ending = 'lost-strongholds' | 'won-barad-dur';

// The Garrison of each Stronghold: Minas Tirith, Lórien, Thranduil's
// Palace, Edoras and the Hornburg.
export const STRONGHOLD_GARRISONS = [33, 61, 64, 67, 68];
export const STRONGHOLDS_TO_LOSE = 3;
export const BARAD_DUR_GARRISON = 148;

export const fallenStrongholds = (roster: RosterEntry[]): number =>
  STRONGHOLD_GARRISONS.filter(index => roster[index]?.strength === 0).length;

export const endingAfterFight = (roster: RosterEntry[]): Ending | null => {
  if (fallenStrongholds(roster) >= STRONGHOLDS_TO_LOSE) {
    return 'lost-strongholds';
  }
  if (roster[BARAD_DUR_GARRISON]?.strength === 0) {
    return 'won-barad-dur';
  }
  return null;
};
