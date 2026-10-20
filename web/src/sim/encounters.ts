// Encounters: the figures in roster entries 152 to 195, which never
// move but wait in an area to be met (docs/spec/encounters.md). The
// search for them runs in the combat search (findMatch); this module
// holds the tests that decide whether a mover meets one, and what
// meeting one changes.

import type { Clock } from './clock';
import { terrainAt, type Tilemap } from './movement';
import { nextRandom, type RngState } from './rng';
import type { RosterEntry } from './starting-state';

export const FIRST_ENCOUNTER = 152;
export const LAST_ENCOUNTER = 195;

// Small figures are met only by Forces led by the Fellowship, entries
// 1 to 12, and large ones only by other Forces
// (finding:forces-encounter-figures-wait-in-areas).
const LAST_FELLOWSHIP_ENTRY = 12;
const SMALL_STRENGTH = 99;

// The Rohirrim scouts' figure, met anywhere for all that they pass by
// (finding:forces-encounters-by-allegiance).
const SCOUTS_FIGURE = 13;

// Bilbo, met only after the Council of Elrond
// (finding:forces-advisors-met-once).
export const BILBO = 154;

// An advisor's chance once met, and Radagast's, who comes back
// (finding:forces-advisors-met-once).
const MET_ONCE_CHANCE = 100;
const RETURNS_CHANCE = 1;

// "<A> passes <B>." and the like: a one-line message, with nothing
// changed (finding:forces-anonymous-encounters-pass-by).
export interface Passing {
  a: number;
  b: number;
}

export interface EncounterWorld {
  clock: Clock;
  rng: RngState;
  roster: RosterEntry[];
  terrainByTile: number[];
  tilemap: Tilemap | null;
  // The roster entry the Animation Level watches, or null while the
  // Campaign Level is on show.
  watching: number | null;
}

export const isEncounter = (index: number): boolean =>
  index >= FIRST_ENCOUNTER && index <= LAST_ENCOUNTER;

const roll = (world: { rng: RngState }, n: number): number => {
  const next = nextRandom(world.rng);
  world.rng = next.state;
  return Math.floor(next.value * n);
};

// Whether a mover meets an Encounter figure on this check: its size,
// area, day and chance, then, for folk, the tile it stands on
// (finding:forces-encounter-figures-wait-in-areas,
// finding:forces-folk-met-only-in-settlements). The chance is out of
// 50 on the Campaign Level and 100 on the Animation Level, and a
// chance of 0 still passes on a roll of 0
// (finding:forces-encounters-by-allegiance).
export const meetsEncounter = (
  world: EncounterWorld,
  mover: RosterEntry,
  figure: RosterEntry
): boolean => {
  const encounter = figure.encounter;
  const position = mover.position;
  if (!encounter || !position) {
    return false;
  }
  const small = figure.strength <= SMALL_STRENGTH;
  if (small !== mover.index <= LAST_FELLOWSHIP_ENTRY) {
    return false;
  }
  const { area } = encounter;
  if (
    position.x < area.left ||
    position.x > area.right ||
    position.y < area.top ||
    position.y > area.bottom ||
    world.clock.day < encounter.earliestDay
  ) {
    return false;
  }
  if (roll(world, world.watching === null ? 50 : 100) > encounter.chance) {
    return false;
  }
  if (figure.fighting > 1) {
    return true;
  }
  const terrain = terrainAt(world, position);
  return terrain === 100 || (terrain >= 80 && roll(world, 2) !== 0);
};

// Whether a met figure that is not Evil goes unmet: the anonymous
// figures are met only by the watched Character on the Animation
// Level, save the Rohirrim scouts
// (finding:forces-encounters-by-allegiance).
export const passesUnseen = (
  world: EncounterWorld,
  moverIndex: number,
  figure: RosterEntry
): boolean =>
  figure.allegiance <= 1 &&
  !(figure.figure === SCOUTS_FIGURE && figure.strength > 1) &&
  world.watching !== moverIndex;

// An advisor is used up as soon as it is met: a chance of 100 drops to
// 0, and Radagast's chance of 1 instead puts his first day 10 to 15
// days on (finding:forces-advisors-met-once).
export const spendAdvisor = (
  world: EncounterWorld,
  index: number
): RosterEntry => {
  const advisor = world.roster[index]!;
  const encounter = advisor.encounter;
  if (!encounter) {
    return advisor;
  }
  let { chance, earliestDay } = encounter;
  if (chance === MET_ONCE_CHANCE) {
    chance = 0;
  }
  if (chance === RETURNS_CHANCE) {
    earliestDay = (world.clock.day + roll(world, 6) + 10) & 0xff;
  }
  const used = { ...advisor, encounter: { ...encounter, chance, earliestDay } };
  world.roster[index] = used;
  return used;
};

// The Council of Elrond lets Bilbo be met (code+0x0dcfe;
// finding:forces-advisors-met-once); this is what holdCouncil does to
// the Encounters.
export const openBilbo = (roster: RosterEntry[]): RosterEntry[] =>
  roster.map(entry =>
    entry.index === BILBO && entry.encounter
      ? { ...entry, encounter: { ...entry.encounter, chance: MET_ONCE_CHANCE } }
      : entry
  );

// After every fight the Encounter figures' health is restored, so an
// Evil Encounter is never used up
// (finding:combat-evil-encounters-attack).
export const restoreEncounterHealth = (roster: RosterEntry[]): RosterEntry[] =>
  roster.map(entry =>
    isEncounter(entry.index) && entry.health !== entry.maxHealth
      ? { ...entry, health: entry.maxHealth }
      : entry
  );
