// Fights: how one starts, its rows, the round loop and its aftermath
// (docs/spec/combat.md). Game time stands still for a whole fight
// (finding:time-stops-during-a-fight): tickSim does nothing while
// state.fight is set, and the view steps the rounds or resolves the
// fight at once when the player ignores it.

import {
  FIRST_ENCOUNTER,
  LAST_ENCOUNTER,
  isEncounter,
  meetsEncounter,
  passesUnseen,
  restoreEncounterHealth,
  spendAdvisor,
  type EncounterWorld,
  type Passing
} from './encounters';
import { endingAfterFight, type Ending } from './endings';
import {
  ADVISOR,
  MOBILISED_ABOVE,
  meetingBetween,
  type Meeting
} from './meetings';
import { dropObjects } from './objects';
import { passRingAfterFight } from './ring';
import { nextRandom, type RngState } from './rng';
import {
  TILE_SIZE,
  topLeader,
  type ObjectPlacement,
  type Point,
  type RosterEntry
} from './starting-state';

// The last Good and last Evil roster entries (finding:forces-roster-order).
export const LAST_GOOD_ENTRY = 78;
export const LAST_EVIL_ENTRY = 151;

export const MEETING_DISTANCE = 7;
export const ROW_DISTANCE = 9;
export const LOSS_DISTANCE = 8;
export const MAX_ROWS_PER_SIDE = 19;

// Objects by bit (finding:objects-carried-as-a-bitmask).
const GNARLED_STAFF = 2;
const MAGIC_WEAPONS = [3, 4, 5];
const MITHRIL_MAIL = 6;
const ELVEN_CLOAK = 8;

// Where a lone Character can't slip away, and the enemy no one evades
// (finding:combat-evasion-chance).
const NO_EVASION_AT: Point[] = [
  { x: 1200, y: 400 },
  { x: 1744, y: 1008 }
];
const SHELOB = 151;
const FIRST_BALROG = 183;
const LAST_BALROG = 187;

// 'charged' is the round after a Charge, 'gone' a row with nothing
// left (finding:combat-option-charge-mechanics).
export type CombatOption =
  'charge' | 'charged' | 'engage' | 'gone' | 'retreat' | 'withdraw';

export type CombatSide = 'evil' | 'good';

export interface CombatRow {
  // Roster entries merged into the row, the first giving its stats.
  entries: number[];
  follower: boolean;
  option: CombatOption;
  side: CombatSide;
  startStrength: number;
  strength: number;
}

// What happened to a row in a round, for the window's messages
// (finding:combat-casualty-messages): losses from its share of the
// enemy's blows or from the blows left over.
export interface CombatEvent {
  blow: 'leftover' | 'share';
  killed: number;
  row: number;
  wounded: number;
}

export interface Fight {
  events: CombatEvent[];
  evil: number;
  good: number;
  position: Point;
  round: number;
  rows: CombatRow[];
  winner: CombatSide | null;
}

export interface CombatWorld {
  // Set by the end of a fight that ends the game.
  ending: Ending | null;
  fight: Fight | null;
  // Where the dead leave what they carried
  // (finding:objects-dead-drop-their-objects).
  objectPlacements: (ObjectPlacement | null)[];
  // Where the Ring's passing leaves its messages, and who bears it
  // (docs/spec/winning-and-losing.md).
  passings: Passing[];
  ringBearer: number | null;
  rng: RngState;
  roster: RosterEntry[];
  routes: number[][];
}

const roll = (world: { rng: RngState }, n: number): number => {
  const next = nextRandom(world.rng);
  world.rng = next.state;
  return Math.floor(next.value * n);
};

const near = (a: Point, b: Point, distance: number): boolean =>
  Math.abs(a.x - b.x) <= distance && Math.abs(a.y - b.y) <= distance;

const isGood = (index: number): boolean =>
  index >= 1 && index <= LAST_GOOD_ENTRY;

const hasMagicWeapon = (entry: RosterEntry): boolean =>
  (entry.unknown.b24 & 1) !== 0 ||
  entry.objects.some(object => MAGIC_WEAPONS.includes(object));

const isProtected = (entry: RosterEntry): boolean =>
  (entry.unknown.b24 & 2) !== 0 ||
  entry.objects.includes(GNARLED_STAFF) ||
  entry.objects.includes(MITHRIL_MAIL);

const fighting = (option: CombatOption): boolean =>
  option === 'charge' || option === 'charged' || option === 'engage';

// The chance out of 100 that a Force slips past its enemy
// (finding:combat-evasion-chance).
const evasionChance = (
  roster: RosterEntry[],
  leader: number
): { chance: number; hasUnit: boolean } => {
  let sum = 0;
  let count = 0;
  let hasUnit = false;
  for (const entry of roster) {
    if (!isGood(entry.index) || entry.state === 0) {
      continue;
    }
    if (topLeader(roster, entry).index !== leader) {
      continue;
    }
    count += 1;
    sum += entry.unknown.b29 ?? 0;
    if (entry.objects.includes(ELVEN_CLOAK)) {
      sum += 20;
    }
    if (entry.startingStrength > 99) {
      count = 99;
      hasUnit = true;
    }
  }
  return {
    chance: Math.floor(sum / Math.max(count, 1)),
    hasUnit
  };
};

// How a list of the Forces near a spot is made: on which Level, the
// Character the Animation Level watches, the enemy a fight is against,
// and whether the fight is being played on the Animation Level
// (finding:combat-rows-capped-by-level-and-enemy).
export interface RowListing {
  animationFight: boolean;
  enemy: number | null;
  level: 'animation' | 'campaign';
  watched: number | null;
}

const CAMPAIGN_LISTING: RowListing = {
  animationFight: false,
  enemy: null,
  level: 'campaign',
  watched: null
};

// A balrog's figure (finding:combat-rows-capped-by-level-and-enemy).
const BALROG_FIGURE = 12;

// A side's most rows: 7 against a balrog, 9 in a fight played on the
// Animation Level, otherwise 19
// (finding:combat-rows-capped-by-level-and-enemy).
const rowCap = (roster: RosterEntry[], listing: RowListing): number => {
  if (
    listing.enemy !== null &&
    roster[listing.enemy]?.figure === BALROG_FIGURE
  ) {
    return 7;
  }
  return listing.animationFight ? 9 : MAX_ROWS_PER_SIDE;
};

// A follower or an Evil Leader joins the row of its name; a Good Leader
// always starts its own (finding:combat-good-leaders-keep-rows-of-their-own).
// Returns whether it started a row.
const addEntry = (
  rows: CombatRow[],
  entry: RosterEntry,
  side: CombatSide,
  follower: boolean,
  roster: RosterEntry[]
): boolean => {
  const merges = follower || side === 'evil';
  const same =
    merges &&
    rows.find(
      row => row.side === side && roster[row.entries[0]!]!.name === entry.name
    );
  if (same) {
    same.entries.push(entry.index);
    same.strength += entry.strength;
    same.startStrength += entry.strength;
    return false;
  }
  rows.push({
    entries: [entry.index],
    follower,
    option: 'engage',
    side,
    startStrength: entry.strength,
    strength: entry.strength
  });
  return true;
};

// A Leader's awake followers among entries 1 to 78, recursively. On the
// second listing, a follower Character whose own followers added no
// row is dropped again
// (finding:combat-rows-relisted-without-lone-followers).
const addFollowers = (
  rows: CombatRow[],
  roster: RosterEntry[],
  leader: number,
  dropLoneCharacters: boolean
): void => {
  for (let i = 1; i <= LAST_GOOD_ENTRY && i < roster.length; i++) {
    const entry = roster[i]!;
    if (entry.leader === leader && entry.state !== 0 && entry.strength > 0) {
      const started = addEntry(rows, entry, 'good', true, roster);
      const count = rows.length;
      addFollowers(rows, roster, i, dropLoneCharacters);
      if (
        dropLoneCharacters &&
        started &&
        rows.length === count &&
        entry.startingStrength === 1
      ) {
        rows.pop();
      }
    }
  }
};

const listGood = (
  roster: RosterEntry[],
  position: Point,
  listing: RowListing,
  cap: number,
  dropLoneCharacters: boolean
): CombatRow[] => {
  const rows: CombatRow[] = [];
  const watched =
    listing.level === 'animation' && listing.watched
      ? roster[listing.watched]
      : undefined;
  if (watched) {
    addEntry(rows, watched, 'good', false, roster);
    addFollowers(rows, roster, watched.index, dropLoneCharacters);
    rows.length = Math.min(rows.length, cap);
  }
  // Entry 78 is listed only on the Campaign Level.
  const last = listing.level === 'campaign' ? LAST_GOOD_ENTRY : 77;
  for (let i = 1; i <= last && i < roster.length; i++) {
    const entry = roster[i]!;
    if (
      entry !== watched &&
      entry.state !== 0 &&
      entry.leader === null &&
      entry.strength > 0 &&
      entry.position !== null &&
      near(entry.position, position, ROW_DISTANCE)
    ) {
      addEntry(rows, entry, 'good', false, roster);
      addFollowers(rows, roster, i, dropLoneCharacters);
    }
  }
  return rows;
};

// Every awake Leader near the spot and its followers, Good rows first
// (finding:combat-good-leaders-keep-rows-of-their-own). Too many Good
// rows are listed again without lone follower Characters, once and only
// under the cap of 19, then cut to the cap. The Evil side stops only
// once it has more rows than the cap, so it can hold one row more;
// against Shelob it lists her alone
// (finding:combat-rows-capped-by-level-and-enemy,
// finding:combat-rows-relisted-without-lone-followers).
export const combatRows = (
  roster: RosterEntry[],
  position: Point,
  listing: RowListing = CAMPAIGN_LISTING
): CombatRow[] => {
  const cap = rowCap(roster, listing);
  let rows = listGood(roster, position, listing, cap, false);
  if (rows.length > cap && cap === MAX_ROWS_PER_SIDE) {
    rows = listGood(roster, position, listing, cap, true);
  }
  rows.length = Math.min(rows.length, cap);
  let evilRows = 0;
  for (let i = LAST_GOOD_ENTRY + 1; i <= LAST_EVIL_ENTRY; i++) {
    if (evilRows > cap) {
      break;
    }
    const entry = roster[i];
    if (
      entry &&
      (listing.enemy !== SHELOB || i === SHELOB) &&
      entry.state !== 0 &&
      entry.leader === null &&
      entry.strength > 0 &&
      entry.position !== null &&
      near(entry.position, position, ROW_DISTANCE) &&
      addEntry(rows, entry, 'evil', false, roster)
    ) {
      evilRows++;
    }
  }
  return rows;
};

// Whom the Campaign Level's magnifying glass watches, going down at
// `position`: the first row of the Forces near the spot, as a fight
// gathers them, when it is a Good Leader among entries 1 to 78; else
// null, nobody watched
// (finding:ui-magnifying-glass-watches-the-first-good-leader-near-the-spot).
export const glassWatches = (
  roster: RosterEntry[],
  position: Point
): number | null => {
  const first = combatRows(roster, position)[0];
  const leader = first?.entries[0];
  return first?.side === 'good' &&
    leader !== undefined &&
    leader >= 1 &&
    leader <= LAST_GOOD_ENTRY
    ? leader
    : null;
};

const tileAligned = (point: Point): boolean =>
  point.x % TILE_SIZE === 0 && point.y % TILE_SIZE === 0;

export type Match =
  { fight: Fight } | { meeting: Meeting } | { passing: Passing };

// What the combat search reads: the fight's world, and the clock, map
// and watched Character the Encounter tests need.
export type MatchWorld = CombatWorld & EncounterWorld;

// Whether the Good side slips past its enemy: a Force of Characters,
// on the evasion roll, save at two tiles and against Shelob or a
// balrog (finding:combat-evasion-chance,
// finding:combat-evil-encounters-attack).
const evades = (
  world: MatchWorld,
  good: RosterEntry,
  evil: RosterEntry,
  at: Point,
  chance: number
): boolean =>
  roll(world, 100) < chance &&
  good.startingStrength === 1 &&
  !NO_EVASION_AT.some(point => point.x === at.x && point.y === at.y) &&
  evil.index !== SHELOB &&
  !(evil.index >= FIRST_BALROG && evil.index <= LAST_BALROG);

// The rows of a fight against `evil`: an Encounter is the only Evil row
// (finding:combat-good-leaders-keep-rows-of-their-own).
const fightRows = (
  roster: RosterEntry[],
  position: Point,
  evil: number,
  listing: Omit<RowListing, 'enemy'>
): CombatRow[] => {
  const rows = combatRows(roster, position, { ...listing, enemy: evil });
  if (!isEncounter(evil)) {
    return rows;
  }
  const good = rows.filter(row => row.side === 'good');
  addEntry(good, roster[evil]!, 'evil', false, roster);
  return good;
};

const fightBetween = (
  world: MatchWorld,
  good: RosterEntry,
  evil: RosterEntry
): Fight => {
  const rows = fightRows(
    world.roster,
    good.position!,
    evil.index,
    CAMPAIGN_LISTING
  );
  return {
    events: [],
    evil: evil.index,
    good: good.index,
    position: { ...good.position! },
    round: 0,
    rows,
    winner: null
  };
};

// Elrond, who keeps a fight on the Campaign Level as a Unit does
// (finding:combat-where-a-fight-is-fought).
const ELROND = 3;

// Whether a fight is played on the Animation Level: no Good row holds a
// Unit, and Elrond doesn't lead one
// (finding:combat-where-a-fight-is-fought).
export const playedOnAnimationLevel = (
  fight: Fight,
  roster: RosterEntry[]
): boolean =>
  !fight.rows.some(
    row =>
      row.side === 'good' &&
      ((row.entries[0] === ELROND && !row.follower) ||
        row.entries.some(index => roster[index]!.startingStrength > 1))
  );

// The most rows a fight's sides were listed with: 7 against a balrog, 9
// when it is played on the Animation Level, otherwise 19
// (finding:combat-rows-capped-by-level-and-enemy).
export const fightRowCap = (fight: Fight, roster: RosterEntry[]): number =>
  rowCap(roster, {
    animationFight: playedOnAnimationLevel(fight, roster),
    enemy: fight.evil,
    level: 'campaign',
    watched: null
  });

// The fight's rows listed again as the Animation Level sets its scene,
// around the watched Character: it comes first, entry 78 is left out
// and each side holds at most 9 rows, or 7 against a balrog
// (finding:combat-animation-level-lists-the-fight-again).
export const listFightOnAnimationLevel = <S extends CombatWorld>(
  state: S,
  watched: number
): S => {
  const fight = state.fight;
  const position = state.roster[watched]?.position;
  if (!fight || !position) {
    return state;
  }
  const rows = fightRows(state.roster, position, fight.evil, {
    animationFight: true,
    level: 'animation',
    watched
  });
  return { ...state, fight: { ...fight, rows } };
};

// What a step meets, searching the roster in order: the first Leader
// it runs into, and whether that is a fight
// (finding:combat-fight-starts-when-evil-meets-non-evil) or a meeting
// (finding:forces-meeting-of-non-evil-leaders), then the Encounter
// figures (docs/spec/encounters.md). Leaders are met only when the
// mover lands on a tile origin; on the Animation Level the Encounters
// are searched on every step, and Evil movers never meet them
// (finding:forces-encounters-by-allegiance). A friendly match that is
// not a meeting is passed by and the search goes on; an evaded enemy
// ends it. Draws from the world's RNG for Encounter checks and enemies.
export const findMatch = (
  world: MatchWorld,
  moverIndex: number
): Match | null => {
  const mover = world.roster[moverIndex];
  if (!mover?.position) {
    return null;
  }
  const aligned = tileAligned(mover.position);
  if (!aligned && world.watching === null) {
    return null;
  }
  const first = aligned ? 1 : FIRST_ENCOUNTER;
  const last = mover.allegiance === 0 ? LAST_GOOD_ENTRY : LAST_ENCOUNTER;
  for (let i = first; i <= last && i < world.roster.length; i++) {
    const other = world.roster[i]!;
    if (i === moverIndex) {
      continue;
    }
    if (isEncounter(i)) {
      if (!meetsEncounter(world, mover, other)) {
        continue;
      }
    } else if (
      (other.state !== 1 && other.state !== 3) ||
      other.leader !== null ||
      other.position === null ||
      !near(other.position, mover.position, MEETING_DISTANCE)
    ) {
      continue;
    }
    if ((mover.allegiance === 0) === (other.allegiance === 0)) {
      if (!isEncounter(i)) {
        const meeting = meetingBetween(mover, other);
        if (meeting) {
          return { meeting };
        }
        continue;
      }
      if (
        mover.allegiance <= MOBILISED_ABOVE ||
        passesUnseen(world, moverIndex, other)
      ) {
        continue;
      }
      if (other.allegiance !== ADVISOR) {
        // On the Animation Level only the watched Character's passing
        // is told (finding:forces-anonymous-encounters-pass-by).
        if (world.watching !== null && world.watching !== moverIndex) {
          return null;
        }
        return { passing: { a: moverIndex, b: i } };
      }
      spendAdvisor(world, i);
      return { meeting: { a: moverIndex, b: i, kind: 'talk' } };
    }
    const [good, evil] =
      mover.allegiance === 0 ? [other, mover] : [mover, other];
    const { chance, hasUnit } = evasionChance(world.roster, good.index);
    // A Force with a Unit ignores small Encounters
    // (finding:combat-evil-encounters-attack).
    if (isEncounter(evil.index) && hasUnit && evil.startingStrength < 99) {
      continue;
    }
    if (evades(world, good, evil, mover.position, chance)) {
      return null;
    }
    return { fight: fightBetween(world, good, evil) };
  }
  return null;
};

// The fight a Leader's step starts, if it starts one.
export const findFight = (
  world: MatchWorld,
  moverIndex: number
): Fight | null => {
  const match = findMatch(world, moverIndex);
  return match && 'fight' in match ? match.fight : null;
};

// Start a fight: both parties stop until it is over. An Encounter
// figure never moves, so it is left as it is.
export const startFight = <T extends CombatWorld>(
  world: T,
  fight: Fight
): T => ({
  ...world,
  fight,
  roster: world.roster.map(entry =>
    (entry.index === fight.good || entry.index === fight.evil) &&
    !isEncounter(entry.index)
      ? { ...entry, state: 2 }
      : entry
  )
});

// Set a Good row's option, under the original's rules
// (finding:combat-option-retreat-and-the-last-fighter). Refused
// changes leave the world as it is.
export const setCombatOption = <T extends CombatWorld>(
  world: T,
  rowIndex: number,
  option: 'charge' | 'engage' | 'retreat' | 'withdraw'
): T => {
  const fight = world.fight;
  const row = fight?.rows[rowIndex];
  if (!fight || fight.winner || !row || row.side !== 'good') {
    return world;
  }
  if (
    row.option === 'retreat' ||
    row.option === 'gone' ||
    row.option === option
  ) {
    return world;
  }
  if (option === 'withdraw' || option === 'retreat') {
    const fighters = fight.rows.filter(candidate => {
      const entry = world.roster[candidate.entries[0]!]!;
      return (
        candidate.side === 'good' &&
        (candidate.option === 'charge' || candidate.option === 'engage') &&
        candidate.strength > 0 &&
        entry.health > 0
      );
    });
    if (fighters.length < 2) {
      return world;
    }
  }
  const rows = fight.rows.map((candidate, i) =>
    i === rowIndex ? { ...candidate, option } : candidate
  );
  return { ...world, fight: { ...fight, rows } };
};

type Sides = [number, number];

type SideIndex = 0 | 1;

const sideOf = (row: CombatRow): SideIndex => (row.side === 'good' ? 0 : 1);

const otherSide = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0);

// One round of the fight (docs/spec/combat.md, "A round").
export const fightRound = <T extends CombatWorld>(world: T): T => {
  if (!world.fight || world.fight.winner) {
    return world;
  }
  const next = { ...world, roster: [...world.roster] };
  const rows = world.fight.rows.map(row => ({
    ...row,
    entries: [...row.entries]
  }));
  const stats = (row: CombatRow): RosterEntry => next.roster[row.entries[0]!]!;
  const wound = (row: CombatRow, health: number): void => {
    const entry = stats(row);
    next.roster[entry.index] = { ...entry, health };
  };

  const strength: Sides = [0, 0];
  const magic: Sides = [0, 0];
  const ordinary: Sides = [0, 0];
  const magicToughness: Sides = [0, 0];
  const headCount: Sides = [0, 0];
  for (const row of rows) {
    const side = sideOf(row);
    if (row.option === 'retreat' || row.option === 'gone') {
      continue;
    }
    strength[side] += row.strength;
    if (row.option === 'withdraw') {
      continue;
    }
    const entry = stats(row);
    const f = entry.fighting;
    const s = row.strength;
    let blow: number;
    if (s === 1) {
      blow = ((roll(next, 8) + 1) * f) >> 3;
      if (roll(next, 100) < 20) {
        blow += f;
        if (roll(next, 100) < 5) {
          blow <<= 4;
        }
      }
    } else {
      blow = (s * f * roll(next, 8)) >> 4;
    }
    if (row.option === 'charge') {
      blow += s * f;
    }
    if (hasMagicWeapon(entry)) {
      magic[side] += blow;
    } else {
      ordinary[side] += blow;
    }
    if (isProtected(entry)) {
      magicToughness[side] += entry.health * f * s;
    } else {
      headCount[side] += s;
    }
  }
  for (const side of [0, 1] as const) {
    const enemy = otherSide(side);
    if (magic[side] > magicToughness[enemy]) {
      ordinary[side] += magic[side] - magicToughness[enemy];
      magic[side] = magicToughness[enemy];
    }
  }
  const pool: Sides = [ordinary[0], ordinary[1]];

  const events: CombatEvent[] = [];
  let goodRowFell = false;
  const lose = (
    rowIndex: number,
    killed: number,
    wounded: number,
    blow: CombatEvent['blow']
  ): void => {
    const row = rows[rowIndex]!;
    const n = Math.min(killed, row.strength);
    if (n > 0 || wounded > 0) {
      events.push({ blow, killed: n, row: rowIndex, wounded });
    }
    row.strength -= n;
    strength[sideOf(row)] -= n;
    if (row.strength === 0) {
      row.option = 'gone';
      if (row.side === 'good') {
        goodRowFell = true;
      }
    }
  };
  // A Character's wound; one that would take all its health kills it.
  const woundOrKill = (
    row: CombatRow,
    w: number
  ): { kill: number; wounded: number } => {
    const entry = stats(row);
    if (w >= entry.health) {
      return { kill: 1, wounded: 0 };
    }
    if (w > 0) {
      wound(row, entry.health - w);
    }
    return { kill: 0, wounded: w };
  };

  // Shares of the enemy's blows.
  rows.forEach((row, rowIndex) => {
    if (!fighting(row.option)) {
      return;
    }
    const own = sideOf(row);
    const enemy = otherSide(own);
    const entry = stats(row);
    const f = entry.fighting;
    const s = row.strength;
    let t = f * entry.health;
    if (row.option === 'charged') {
      t = Math.floor((2 * t) / 3);
    }
    t = Math.max(t, 1);
    let n = 0;
    let w = 0;
    if (isProtected(entry)) {
      n = Math.floor(magic[enemy] / t);
      if (n >= s) {
        magic[enemy] -= s * t;
        n = s;
      } else {
        magic[enemy] -= n * t;
        const q = Math.floor(pool[enemy] / (4 * t));
        if (n + q > s) {
          pool[enemy] -= 4 * t * (s - n);
          n = s;
        } else {
          pool[enemy] -= 4 * t * q;
          n += q;
        }
      }
      if (row.startStrength === 1 && n === 0) {
        if (magic[enemy] !== 0) {
          w = f > 0 ? Math.floor(magic[enemy] / f) : magic[enemy];
          magic[enemy] -= w * f;
        } else if (ordinary[enemy] > 4 * f && roll(next, 3) === 0) {
          ordinary[enemy] -= 4 * f;
          pool[enemy] = ordinary[enemy];
          w = 1;
        }
        const result = woundOrKill(row, w);
        n += result.kill;
        w = result.wounded;
      }
    } else {
      n =
        headCount[own] > 0
          ? Math.floor((ordinary[enemy] * s) / (t * headCount[own]))
          : ordinary[enemy] * s;
      if (n * t > pool[enemy]) {
        n = Math.floor(pool[enemy] / t);
      }
      if (n > s) {
        pool[enemy] -= s * t;
        n = s;
      } else {
        pool[enemy] -= n * t;
      }
    }
    lose(rowIndex, n, w, 'share');
  });

  // The blows left over, rows in order.
  rows.forEach((row, rowIndex) => {
    const enemy = otherSide(sideOf(row));
    const entry = stats(row);
    if (!fighting(row.option) || pool[enemy] <= 0 || isProtected(entry)) {
      return;
    }
    let f = entry.fighting;
    if (row.option === 'charged') {
      f = Math.floor((4 * f) / 3);
    }
    f = Math.max(f, 1);
    const t = Math.max(f * entry.health, 1);
    let n = Math.min(Math.floor(pool[enemy] / t), row.strength);
    pool[enemy] -= n * t;
    let w = 0;
    if (row.startStrength === 1 && n === 0) {
      w = Math.floor(pool[enemy] / f);
      pool[enemy] -= w * f;
      const result = woundOrKill(row, w);
      n += result.kill;
      w = result.wounded;
    }
    lose(rowIndex, n, w, 'leftover');
  });

  // The Good rows' options move on.
  for (const row of rows) {
    if (row.side !== 'good') {
      continue;
    }
    if (row.option === 'charged') {
      row.option = 'engage';
    }
    if (goodRowFell && row.option === 'withdraw') {
      row.option = 'engage';
    }
    if (row.option === 'charge') {
      row.option = 'charged';
    }
  }

  let winner: CombatSide | null = null;
  if (strength[0] <= 0 || strength[1] <= 0) {
    winner = strength[0] > 0 ? 'good' : 'evil';
  }
  next.fight = {
    ...world.fight,
    events,
    round: world.fight.round + 1,
    rows,
    winner
  };
  return next;
};

// Take each row's losses, release the survivors and re-attach the
// followers of the dead (docs/spec/combat.md, "The end of a fight").
// An Encounter takes no losses and has its health restored
// (finding:combat-evil-encounters-attack).
export const finishFight = <T extends CombatWorld>(world: T): T => {
  const fight = world.fight;
  if (!fight || !fight.winner) {
    return world;
  }
  const roster = [...world.roster];
  const routes = world.routes.map(route => [...route]);
  let objectPlacements = world.objectPlacements;
  for (const row of fight.rows) {
    let loss = row.startStrength - row.strength;
    const name = roster[row.entries[0]!]!.name;
    for (
      let i = row.entries[0]!;
      i <= LAST_EVIL_ENTRY && i < roster.length;
      i++
    ) {
      const entry = roster[i]!;
      const leader = topLeader(roster, entry);
      if (
        entry.state === 0 ||
        entry.name !== name ||
        leader.position === null ||
        !near(leader.position, fight.position, LOSS_DISTANCE)
      ) {
        continue;
      }
      const taken = Math.min(loss, entry.strength);
      loss -= taken;
      const strength = entry.strength - taken;
      const dead = strength === 0 || entry.health === 0;
      // The dead leave everything they carried, the Ring included, at
      // the place of the fight; their own objects are not cleared
      // (finding:objects-dead-drop-their-objects).
      if (dead) {
        objectPlacements = dropObjects(
          objectPlacements,
          entry.objects,
          fight.position
        );
      }
      roster[i] = {
        ...entry,
        health: row.side === 'evil' ? entry.maxHealth : entry.health,
        state: dead ? 0 : 1,
        strength: dead ? 0 : strength
      };
    }
  }
  for (let i = 1; i <= LAST_GOOD_ENTRY && i < roster.length; i++) {
    const entry = roster[i]!;
    if (entry.state === 0 || entry.leader === null) {
      continue;
    }
    let leader: RosterEntry | undefined = roster[entry.leader];
    let top = leader;
    while (leader && leader.strength === 0) {
      top = leader;
      leader = leader.leader === null ? undefined : roster[leader.leader];
    }
    if (leader) {
      roster[i] = { ...entry, leader: leader.index };
      continue;
    }
    if (!top) {
      continue;
    }
    if (routes[entry.route]) {
      routes[entry.route] = [];
    }
    roster[i] = {
      ...entry,
      allegiance: entry.allegiance < 4 ? top.allegiance : entry.allegiance,
      destination: top.destination ? { ...top.destination } : null,
      facing: top.facing,
      leader: null,
      position: top.position ? { ...top.position } : null
    };
  }
  const passed = passRingAfterFight({
    ...world,
    objectPlacements,
    roster,
    routes
  });
  return {
    ...passed,
    ending: world.ending ?? endingAfterFight(passed.roster),
    fight: null,
    roster: restoreEncounterHealth(passed.roster)
  };
};

// An ignored fight: every round on Engage, straight to the end
// (finding:combat-ignored-fight-resolved-at-once). Options the player
// set are kept, but an ignored fight never offers them.
export const resolveFight = <T extends CombatWorld>(world: T): T => {
  let next = world;
  while (next.fight && !next.fight.winner) {
    next = fightRound(next);
  }
  return finishFight(next);
};
