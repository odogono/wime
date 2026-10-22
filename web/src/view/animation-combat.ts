// Character fights on the Animation Level (docs/spec/encounters.md,
// "Fights on the Animation Level"). All rules and orders remain in the
// combat controller and sim; this module only places and moves figures.
import {
  playedOnAnimationLevel,
  type Fight,
  type SimState
} from '../sim/index';
import {
  MAX_FIGURES,
  drawFigures,
  figureCount,
  stepStage,
  type Stage
} from './animation-level';
import type { AnimationAssets } from './assets';
import {
  SPELL_FLASH,
  STOPPED,
  newFigure,
  runEntries,
  startScript,
  type Figure,
  type ScriptWorld
} from './figure-script';

type World = Omit<ScriptWorld, 'laggardLine'>;

export const fightOnAnimationLevel = (sim: SimState): boolean =>
  !!sim.fight && playedOnAnimationLevel(sim.fight, sim.roster);

export interface BattleStage {
  // Whether the winners stand and the beaten Evil side has fallen.
  ended: boolean;
  fallen: boolean[];
  // Each fight row's figure indices, fixed when the battle is spawned.
  members: number[][];
  phase: 'approach' | 'fighting';
  // The last round the rows swung in, and each row's strength then.
  round: number;
  rows: number[];
  stage: Stage;
  strengths: number[];
  world: World;
}

// Script entries (finding:combat-animation-level-figures-follow-fight-entries):
// each side walks to its line, then holds its stance; a swing; a fall;
// and standing still.
const GOOD_APPROACH = 0xa0;
const EVIL_APPROACH = 0xb8;
const STANCE = 0x18;
const SWING = 0x2a;
const LUNGE = 0x1a;
const RECOIL = 0x4c;
const FALL = 0x4f;
const STAND = 0x00;

export const spawnBattle = (
  sim: SimState,
  world: World,
  random: (n: number) => number,
  vbl: number
): BattleStage => {
  const fight = sim.fight!;
  const figures: Figure[] = [];
  const rows: number[] = [];
  const members: number[][] = fight.rows.map(() => []);
  const slots = { evil: 0, good: 0 };
  const spawnWorld = { ...world, laggardLine: 1000 };
  fight.rows.forEach((row, r) => {
    const entry = sim.roster[row.entries[0]!]!;
    if (entry.figure >= 20) {
      return;
    }
    const count = Math.min(
      figureCount(row.strength, entry.figure),
      MAX_FIGURES - figures.length
    );
    const good = row.side === 'good';
    for (let k = 0; k < count; k++) {
      const slot = slots[row.side]++;
      const figure = newFigure(
        spawnWorld,
        entry.figure,
        2,
        good ? 90 - (slot % 5) * 16 - random(10) : 310 + slot * 10,
        (good ? 165 : 166) + (slot % 5) * 2,
        150 + (slot % 5) * 2,
        entry.index
      );
      members[r]!.push(figures.length);
      figures.push({
        ...runEntries(figure, [good ? GOOD_APPROACH : EVIL_APPROACH, STANCE]),
        flipped: !good,
        next: vbl
      });
      rows.push(r);
    }
  });
  // The lines are 25 and 85 pixels past the rightmost Good figure, or
  // past x 100 when the first Evil row is a balrog (code+0x0b34a).
  const firstEvil = fight.rows.find(row => row.side === 'evil')?.entries[0];
  const balrog =
    firstEvil !== undefined && firstEvil >= 183 && firstEvil <= 187;
  const rightmost = balrog
    ? 100
    : figures.reduce(
        (x, figure, i) =>
          fight.rows[rows[i]!]!.side === 'good' ? Math.max(x, figure.x) : x,
        0
      );
  const line1 = rightmost + 25;
  const line2 = rightmost + 85;
  return {
    ended: false,
    fallen: figures.map(() => false),
    members,
    phase: 'approach',
    round: fight.round,
    rows,
    stage: { figures, party: slots.good },
    strengths: fight.rows.map(row => row.strength),
    world: { ...world, fighting: true, line1, line2 }
  };
};

// How many of a row's figures fall for a loss: losses × 10 / its
// strength when the fight began, or the losses themselves for a row
// that began 10 strong or less (code+0x11b10).
export const fallsFor = (start: number, losses: number): number => {
  const share = start > 10 ? Math.floor((losses * 20) / start) : losses * 2;
  return share > 1 ? share >> 1 : 0;
};

// Set figures on a script entry list from this vertical blank.
const queue = (
  figures: Figure[],
  indices: readonly number[],
  entries: number[],
  vbl: number
): void => {
  for (const i of indices) {
    figures[i] = { ...runEntries(figures[i]!, entries), next: vbl };
  }
};

// The rows' swings each round, recoils and lunges for a wound, falls
// for each loss, and at the end the winners standing and a beaten Evil
// side falling
// (finding:combat-animation-level-figures-follow-fight-entries). It never decides
// a blow or consumes the sim's RNG.
const react = (battle: BattleStage, fight: Fight, vbl: number): BattleStage => {
  const figures = battle.stage.figures.slice();
  const fallen = battle.fallen.slice();
  const living = (r: number): number[] =>
    battle.members[r]!.filter(i => !fallen[i]);
  fight.rows.forEach((row, r) => {
    const losses = battle.strengths[r]! - row.strength;
    // A killed Character's row falls entire (code+0x117ca).
    const falls =
      losses > 0 && row.strength === 0
        ? living(r).length
        : fallsFor(row.startStrength, losses);
    const falling = falls > 0 ? living(r).slice(-falls) : [];
    queue(figures, falling, [FALL], vbl);
    for (const i of falling) {
      fallen[i] = true;
    }
  });
  if (battle.phase === 'fighting' && fight.round > battle.round) {
    fight.rows.forEach((row, r) => {
      // Charge swings three times a round, Engage twice (code+0x1101c,
      // code+0x11150).
      const swings =
        row.option === 'charge' || row.option === 'charged'
          ? 3
          : row.option === 'engage'
            ? 2
            : 0;
      if (swings > 0) {
        queue(
          figures,
          living(r),
          [...Array.from({ length: swings }, () => SWING), STANCE],
          vbl
        );
      }
    });
    // A wounded individual's side recoils and the first row on the
    // other side that Charges or Engages lunges (code+0x117f6).
    for (const event of fight.events) {
      if (event.wounded === 0 || event.killed > 0) {
        continue;
      }
      const side = fight.rows[event.row]!.side;
      fight.rows.forEach((row, r) => {
        if (row.side === side) {
          queue(figures, living(r), [RECOIL, STANCE], vbl);
        }
      });
      const lunging = fight.rows.findIndex(
        row =>
          row.side !== side &&
          (row.option === 'charge' ||
            row.option === 'charged' ||
            row.option === 'engage')
      );
      if (lunging >= 0) {
        queue(figures, living(lunging), [LUNGE, STANCE], vbl);
      }
    }
  }
  let ended = battle.ended;
  if (fight.winner && !ended) {
    ended = true;
    fight.rows.forEach((row, r) => {
      if (fight.winner === 'good' && row.side === 'evil') {
        queue(figures, living(r), [FALL], vbl);
        for (const i of living(r)) {
          fallen[i] = true;
        }
      } else if (row.side === fight.winner) {
        queue(figures, living(r), [STAND], vbl);
      }
    });
  }
  return {
    ...battle,
    ended,
    fallen,
    round: Math.max(battle.round, fight.round),
    stage: { ...battle.stage, figures },
    strengths: fight.rows.map(row => row.strength)
  };
};

// Each side walks to its line at its figures' own pace and holds its
// stance; the fight starts once every figure has
// (finding:combat-character-fights-on-animation-level).
export const stepBattle = (
  battle: BattleStage,
  fight: Fight,
  vbl: number
): BattleStage => {
  const reacted = react(battle, fight, vbl);
  const stage = stepStage(reacted.stage, reacted.world, vbl);
  const arrived = stage.figures.every(
    (figure, i) =>
      figure.frml === SPELL_FLASH ||
      reacted.fallen[i] ||
      figure.next === STOPPED
  );
  return {
    ...reacted,
    phase: reacted.phase === 'fighting' || arrived ? 'fighting' : 'approach',
    stage
  };
};

export const drawBattle = (
  ctx: CanvasRenderingContext2D,
  assets: AnimationAssets,
  battle: BattleStage
): void => {
  drawFigures(ctx, assets, battle.stage);
};

// Only surviving Good figures walk on; casualties and the Evil figures
// belong to the finished fight, not the watched Force's onward walk.
export const walkAfterBattle = (
  battle: BattleStage,
  fight: Fight,
  vbl: number
): Stage => ({
  figures: battle.stage.figures.flatMap((figure, i) =>
    figure.frml !== SPELL_FLASH &&
    !battle.fallen[i] &&
    fight.rows[battle.rows[i]!]!.side === 'good'
      ? [
          {
            ...startScript({ ...figure, next: STOPPED, returns: [] }, 2),
            flipped: false,
            next: vbl
          }
        ]
      : []
  ),
  party: battle.stage.party
});
