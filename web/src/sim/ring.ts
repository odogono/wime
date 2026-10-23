// The Ring's passing after a fight and the Ring's two endings
// (docs/spec/winning-and-losing.md). The Ring left at a fight's place
// goes to one of the winners (finding:objects-encounter-revives-third-nazgul);
// the Ring-bearer's Leader on Mount Doom at the hour wins the game
// (finding:objects-ring-at-mount-doom-checked-hourly), and an Evil
// Leader carrying the Ring onto Barad-dûr loses it
// (finding:objects-ring-at-barad-dur-loses).

import type { CombatRow, Fight } from './combat';
import type { Passing } from './encounters';
import type { Ending } from './endings';
import { RING } from './objects';
import { nextRandom, type RngState } from './rng';
import {
  topLeader,
  type ObjectPlacement,
  type Point,
  type RosterEntry
} from './starting-state';

export const MOUNT_DOOM: Point = { x: 1808, y: 1120 };
export const BARAD_DUR: Point = { x: 1856, y: 1120 };

const GOLLUM = 78;
const FIRST_NAZGUL = 79;
const THIRD_NAZGUL = 81;
const LAST_NAZGUL = 87;
const LAST_FORCE_ENTRY = 151;
// The Hobbits' Animation Level figure (finding:objects-encounter-revives-third-nazgul).
const HOBBIT_FIGURE = 0;

// Where the other awake Nazgûl are sent when an Evil bearer takes the
// Ring, by a roll of 4: Dol Guldur, the Morannon, then Minas Morgul
// twice (finding:objects-encounter-revives-third-nazgul).
const NAZGUL_SCATTER: Point[] = [
  { x: 1456, y: 672 },
  { x: 1744, y: 1008 },
  { x: 1664, y: 1168 },
  { x: 1664, y: 1168 }
];

export interface RingWorld {
  fight: Fight | null;
  objectPlacements: (ObjectPlacement | null)[];
  passings: Passing[];
  ringBearer: number | null;
  rng: RngState;
  roster: RosterEntry[];
  routes: number[][];
}

const isAt = (point: Point | null, at: Point): boolean =>
  point !== null && point.x === at.x && point.y === at.y;

const isCharacter = (entry: RosterEntry): boolean =>
  entry.startingStrength === 1;

// The roster entry to take the Ring from the winners' rows, or null.
// Good: the first living Hobbit, else the last-listed awake row, Gollum
// only while Good's whole strength is his. Evil: the last-listed awake
// Evil row. The rows are read through their first entry
// (finding:objects-encounter-revives-third-nazgul).
const newBearer = (
  roster: RosterEntry[],
  rows: CombatRow[],
  winner: 'evil' | 'good'
): number | null => {
  const winners = rows.filter(row => row.side === winner);
  const sideRows = winners.map(row => roster[row.entries[0]!]!);
  if (winner === 'good') {
    const hobbit = sideRows.find(
      entry =>
        isCharacter(entry) &&
        entry.strength > 0 &&
        entry.index !== GOLLUM &&
        entry.figure === HOBBIT_FIGURE
    );
    if (hobbit) {
      return hobbit.index;
    }
  }
  const strength = winners.reduce((sum, row) => sum + row.strength, 0);
  for (const entry of sideRows.toReversed()) {
    if (entry.index === 0 || entry.state === 0) {
      continue;
    }
    if (winner === 'good' && entry.index === GOLLUM && strength !== 1) {
      continue;
    }
    return entry.index;
  }
  return null;
};

// At the end of a fight, after the dead have dropped what they carried:
// a Ring lying exactly at the fight's place is taken from the ground,
// even if nobody is left to take it, and goes to one of the winners. An
// Evil bearer leaves its Force and sets off for Barad-dûr, and the
// other awake Nazgûl scatter. With an Encounter for the winner, the 3rd
// Nazgûl is revived and moved to the Ring's place to take it
// (finding:objects-encounter-revives-third-nazgul).
export const passRingAfterFight = <T extends RingWorld>(world: T): T => {
  const fight = world.fight;
  if (!fight?.winner) {
    return world;
  }
  const slot = world.objectPlacements.findIndex(
    candidate =>
      candidate?.object === RING && isAt(candidate.position, fight.position)
  );
  if (slot === -1) {
    return world;
  }
  const next = {
    ...world,
    objectPlacements: world.objectPlacements.map((candidate, i) =>
      i === slot ? null : candidate
    ),
    passings: [...world.passings],
    roster: [...world.roster],
    routes: world.routes.map(route => [...route])
  };
  let bearer: number | null;
  if (fight.winner === 'evil' && fight.evil > LAST_FORCE_ENTRY) {
    const nazgul = next.roster[THIRD_NAZGUL]!;
    next.roster[THIRD_NAZGUL] = {
      ...nazgul,
      health: nazgul.maxHealth,
      position: { ...fight.position },
      state: 1,
      strength: 1
    };
    next.passings.push({ kind: 'nazgul-sent' });
    bearer = THIRD_NAZGUL;
  } else {
    bearer = newBearer(next.roster, fight.rows, fight.winner);
  }
  if (bearer === null) {
    return next;
  }
  const taker = next.roster[bearer]!;
  next.ringBearer = bearer;
  next.roster[bearer] = {
    ...taker,
    objects: taker.objects.includes(RING)
      ? taker.objects
      : [RING, ...taker.objects]
  };
  next.passings.push({ bearer, kind: 'ring' });
  if (fight.winner === 'good') {
    return next;
  }
  next.roster[bearer] = {
    ...next.roster[bearer]!,
    destination: { ...BARAD_DUR },
    leader: null
  };
  if (next.routes[taker.route]) {
    next.routes[taker.route] = [];
  }
  for (let i = FIRST_NAZGUL; i <= LAST_NAZGUL; i++) {
    const nazgul = next.roster[i];
    if (!nazgul || nazgul.state === 0 || nazgul.objects.includes(RING)) {
      continue;
    }
    const roll = nextRandom(next.rng);
    next.rng = roll.state;
    next.roster[i] = {
      ...nazgul,
      destination: { ...NAZGUL_SCATTER[Math.floor(roll.value * 4)]! }
    };
    if (next.routes[nazgul.route]) {
      next.routes[nazgul.route] = [];
    }
  }
  return next;
};

// The hourly test: the Ring-bearer's top Leader standing exactly on
// Mount Doom wins, whatever its allegiance
// (finding:objects-ring-at-mount-doom-checked-hourly).
export const ringAtMountDoom = (
  roster: RosterEntry[],
  ringBearer: number | null
): Ending | null => {
  const bearer = ringBearer === null ? undefined : roster[ringBearer];
  return bearer && isAt(topLeader(roster, bearer).position, MOUNT_DOOM)
    ? 'won-mount-doom'
    : null;
};

// Tested with the tripwires after a Leader's step: an Evil Leader whose
// own objects hold the Ring, on a tile origin at Barad-dûr
// (finding:objects-ring-at-barad-dur-loses).
export const ringAtBaradDur = (leader: RosterEntry): Ending | null =>
  leader.allegiance === 0 &&
  leader.objects.includes(RING) &&
  isAt(leader.position, BARAD_DUR)
    ? 'lost-barad-dur'
    : null;
