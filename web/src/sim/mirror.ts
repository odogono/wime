import {
  placeAt,
  type Place,
  type Point,
  type RosterEntry
} from './starting-state';

// Galadriel's Mirror: the Forces on the move, as the Full Map Level's
// eye lists them (docs/spec/full-map.md,
// finding:ui-galadriels-mirror-lists-forces-on-the-move).

// Good entries are 1 to 77 and their followers 1 to 78; Evil entries
// are 79 to 151.
const LAST_GOOD = 77;
const LAST_FOLLOWER = 78;
const FIRST_EVIL = 79;
const LAST_EVIL = 151;

// Each column shows at most this many rows
// (finding:ui-galadriels-mirror-row-limit); provisional.
export const MIRROR_ROW_LIMIT = 19;

export const MIRROR_HEADING =
  'In the still surface of the pool, you see forces moving...';

export interface MirrorRow {
  // A follower's row is set 6 pixels to the right.
  follower: boolean;
  text: string;
}

export interface MirrorListing {
  evil: string[];
  good: MirrorRow[];
}

// The original's direction names, by facing 0 to 7 clockwise from
// north, and the facing for each sign of the move across and down
// (data+0x421c, finding:ui-galadriels-mirror-lists-forces-on-the-move).
const DIRECTION_NAMES = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest'
];
const FACING_BY_SIGN = [7, 0, 1, 0, 6, 0, 2, 0, 5, 4, 3];

// The way from a position to a destination: east or west when twice
// the distance across is at least the distance down, north or south
// when twice the distance down is at least the distance across.
export const headingName = (from: Point, to: Point): string => {
  const across = Math.abs(from.x - to.x);
  const down = Math.abs(from.y - to.y);
  const sx = across * 2 >= down ? (to.x >= from.x ? 1 : -1) : 0;
  const sy = down * 2 >= across ? (to.y >= from.y ? 1 : -1) : 0;
  return DIRECTION_NAMES[FACING_BY_SIGN[(sy + 1) * 4 + sx + 1]!]!;
};

// A name with its first letter capitalised, as the original writes a
// single figure's name.
const capitalised = (name: string): string =>
  name.charAt(0).toUpperCase() + name.slice(1);

// Listed on the Mirror: awake, leading its own Force and on the move.
const isMoving = (entry: RosterEntry | undefined): entry is RosterEntry =>
  entry !== undefined &&
  entry.state !== 0 &&
  entry.leader === null &&
  entry.position !== null &&
  entry.destination !== null;

interface Row {
  entry: RosterEntry;
  follower: boolean;
  strength: number;
}

const goodRowText = (
  { entry, follower, strength }: Row,
  roster: RosterEntry[],
  places: Place[]
): string => {
  const single = strength <= 1;
  const subject = single
    ? `${capitalised(entry.name)} is`
    : `${strength} ${entry.name} are`;
  if (strength === 0) {
    return entry.startingStrength > 1
      ? `All of the ${entry.name} are dead.`
      : `${subject} dead.`;
  }
  if (follower && entry.leader !== null) {
    return `${subject} following ${roster[entry.leader]?.name ?? ''}.`;
  }
  if (entry.position && entry.destination) {
    const place = placeAt(places, entry.destination);
    return place
      ? `${subject} going to ${place.name}.`
      : `${subject} heading ${headingName(entry.position, entry.destination)}.`;
  }
  return `${subject} resting.`;
};

// Merge a row into one already listed with the same name, or add it.
const addMerged = (rows: Row[], row: Row): void => {
  const same = rows.find(other => other.entry.name === row.entry.name);
  if (same) {
    same.strength += row.strength;
  } else {
    rows.push(row);
  }
};

export const mirrorListing = (
  roster: RosterEntry[],
  places: Place[]
): MirrorListing => {
  const good: Row[] = [];
  for (let index = 1; index <= LAST_GOOD; index++) {
    const leader = roster[index];
    if (!isMoving(leader)) {
      continue;
    }
    good.push({ entry: leader, follower: false, strength: leader.strength });
    for (let other = 1; other <= LAST_FOLLOWER; other++) {
      const follower = roster[other];
      if (follower && follower.state !== 0 && follower.leader === index) {
        addMerged(good, {
          entry: follower,
          follower: true,
          strength: follower.strength
        });
      }
    }
  }
  const evil: Row[] = [];
  for (let index = FIRST_EVIL; index <= LAST_EVIL; index++) {
    const entry = roster[index];
    if (isMoving(entry)) {
      addMerged(evil, { entry, follower: false, strength: entry.strength });
    }
  }
  return {
    evil: evil
      .slice(0, MIRROR_ROW_LIMIT)
      .map(({ entry, strength }) =>
        strength > 1 ? `${strength} ${entry.name}` : capitalised(entry.name)
      ),
    good: good.slice(0, MIRROR_ROW_LIMIT).map(row => ({
      follower: row.follower,
      text: goodRowText(row, roster, places)
    }))
  };
};
