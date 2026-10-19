// Fights: how one starts, its rows, the round loop and its aftermath
// (docs/spec/combat.md). Game time stands still for a whole fight
// (finding:time-stops-during-a-fight): tickSim does nothing while
// state.fight is set, and the view steps the rounds or resolves the
// fight at once when the player ignores it.

import { nextRandom, type RngState } from './rng';
import {
  TILE_SIZE,
  topLeader,
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
  fight: Fight | null;
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
const evasionChance = (roster: RosterEntry[], leader: number): number => {
  let sum = 0;
  let count = 0;
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
    }
  }
  return Math.floor(sum / Math.max(count, 1));
};

const addEntry = (
  rows: CombatRow[],
  entry: RosterEntry,
  side: CombatSide,
  follower: boolean,
  roster: RosterEntry[]
): void => {
  const same = rows.find(
    row => row.side === side && roster[row.entries[0]!]!.name === entry.name
  );
  if (same) {
    same.entries.push(entry.index);
    same.strength += entry.strength;
    same.startStrength += entry.strength;
    return;
  }
  if (rows.filter(row => row.side === side).length >= MAX_ROWS_PER_SIDE) {
    return;
  }
  rows.push({
    entries: [entry.index],
    follower,
    option: 'engage',
    side,
    startStrength: entry.strength,
    strength: entry.strength
  });
};

const addFollowers = (
  rows: CombatRow[],
  roster: RosterEntry[],
  leader: number
): void => {
  for (const entry of roster) {
    if (entry.leader === leader && entry.state !== 0 && entry.strength > 0) {
      addEntry(rows, entry, 'good', true, roster);
      addFollowers(rows, roster, entry.index);
    }
  }
};

// Every awake Leader near the fight and its followers, Good rows first
// (finding:combat-rows-merge-like-named-forces).
export const combatRows = (
  roster: RosterEntry[],
  position: Point
): CombatRow[] => {
  const rows: CombatRow[] = [];
  const leaders = roster.filter(
    entry =>
      entry.state !== 0 &&
      entry.leader === null &&
      entry.strength > 0 &&
      entry.position !== null &&
      near(entry.position, position, ROW_DISTANCE)
  );
  for (const entry of leaders) {
    if (isGood(entry.index)) {
      addEntry(rows, entry, 'good', false, roster);
      addFollowers(rows, roster, entry.index);
    }
  }
  for (const entry of leaders) {
    if (entry.index > LAST_GOOD_ENTRY && entry.index <= LAST_EVIL_ENTRY) {
      addEntry(rows, entry, 'evil', false, roster);
    }
  }
  return rows;
};

const tileAligned = (point: Point): boolean =>
  point.x % TILE_SIZE === 0 && point.y % TILE_SIZE === 0;

// After a Leader's step lands on a tile origin: the first Leader it
// meets, and whether that starts a fight
// (finding:combat-fight-starts-when-evil-meets-non-evil). Returns the
// new fight, or null for no fight; either way draws from the world's
// RNG only when an enemy is met.
export const findFight = (
  world: CombatWorld,
  moverIndex: number
): Fight | null => {
  const mover = world.roster[moverIndex];
  if (!mover?.position || !tileAligned(mover.position)) {
    return null;
  }
  const last = mover.allegiance === 0 ? LAST_GOOD_ENTRY : LAST_EVIL_ENTRY;
  for (let i = 1; i <= last && i < world.roster.length; i++) {
    const other = world.roster[i]!;
    if (
      i === moverIndex ||
      (other.state !== 1 && other.state !== 3) ||
      other.leader !== null ||
      other.position === null ||
      !near(other.position, mover.position, MEETING_DISTANCE)
    ) {
      continue;
    }
    if ((mover.allegiance === 0) === (other.allegiance === 0)) {
      // A friendly meeting in the original; not modelled yet
      // (docs/spec/combat.md).
      continue;
    }
    const [good, evil] =
      mover.allegiance === 0 ? [other, mover] : [mover, other];
    const chance = evasionChance(world.roster, good.index);
    if (
      roll(world, 100) < chance &&
      good.startingStrength === 1 &&
      !NO_EVASION_AT.some(
        point => point.x === mover.position!.x && point.y === mover.position!.y
      ) &&
      evil.index !== SHELOB
    ) {
      return null;
    }
    return {
      events: [],
      evil: evil.index,
      good: good.index,
      position: { ...good.position! },
      round: 0,
      rows: combatRows(world.roster, good.position!),
      winner: null
    };
  }
  return null;
};

// Start a fight: both parties stop until it is over.
export const startFight = <T extends CombatWorld>(
  world: T,
  fight: Fight
): T => ({
  ...world,
  fight,
  roster: world.roster.map(entry =>
    entry.index === fight.good || entry.index === fight.evil
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
export const finishFight = <T extends CombatWorld>(world: T): T => {
  const fight = world.fight;
  if (!fight || !fight.winner) {
    return world;
  }
  const roster = [...world.roster];
  const routes = world.routes.map(route => [...route]);
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
  return { ...world, fight: null, roster, routes };
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
