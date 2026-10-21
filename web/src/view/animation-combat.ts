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
  startScript,
  type Figure,
  type ScriptWorld
} from './figure-script';

type World = Omit<ScriptWorld, 'laggardLine'>;

export const fightOnAnimationLevel = (sim: SimState): boolean =>
  !!sim.fight && playedOnAnimationLevel(sim.fight, sim.roster);

export interface BattleStage {
  fallen: boolean[];
  homes: number[];
  // Each fight row's figure indices, fixed when the battle is spawned.
  members: number[][];
  phase: 'approach' | 'fighting';
  rows: number[];
  stage: Stage;
  vbl: number;
  world: World;
}

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
  const slotOf: number[] = [];
  const slots = { evil: 0, good: 0 };
  const spawnWorld = { ...world, laggardLine: 1000 };
  // Losses are scaled against the starting figure count, rather than
  // spawning a figure per soldier.
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
      slotOf.push(slot);
      figures.push({ ...figure, flipped: !good, next: vbl });
      rows.push(r);
    }
  });
  const rightmost = figures.reduce(
    (x, figure, i) =>
      fight.rows[rows[i]!]!.side === 'good' ? Math.max(x, figure.x) : x,
    0
  );
  const line1 = rightmost + 25;
  const line2 = rightmost + (fight.evil >= 183 && fight.evil <= 187 ? 100 : 85);
  const homes = figures.map((_, i) => {
    const offset = (slotOf[i]! % 5) * 8;
    return fight.rows[rows[i]!]!.side === 'good'
      ? line1 - offset
      : line2 + offset;
  });
  return {
    fallen: figures.map(() => false),
    homes,
    members,
    phase: 'approach',
    rows,
    stage: { figures, party: slots.good },
    vbl,
    world: { ...world, fighting: true, line1, line2 }
  };
};

// Keep a proportional number of each row's original figures standing.
export const markFallen = (battle: BattleStage, fight: Fight): BattleStage => {
  const fallen = battle.fallen.slice();
  fight.rows.forEach((row, r) => {
    const indices = battle.members[r]!;
    const living = Math.ceil(
      (indices.length * row.strength) / Math.max(1, row.startStrength)
    );
    indices.forEach((index, k) => {
      fallen[index] = k >= living;
    });
  });
  return { ...battle, fallen };
};

// Approach speed, lunges and fall poses are provisional choreography;
// they never decide when a blow lands or consume the sim's RNG.
export const stepBattle = (
  battle: BattleStage,
  fight: Fight,
  vbl: number
): BattleStage => {
  const stepped = stepStage(battle.stage, battle.world, vbl);
  const elapsed = Math.max(0, vbl - battle.vbl);
  const { fallen } = markFallen(battle, fight);
  const figures = stepped.figures.map((figure, i) => {
    // Flashes follow their own scripts, outside the fight rows.
    if (figure.frml === SPELL_FLASH) {
      return figure;
    }
    if (fallen[i]) {
      return { ...battle.stage.figures[i]!, next: STOPPED };
    }
    const row = fight.rows[battle.rows[i]!]!;
    const good = row.side === 'good';
    figure = { ...figure, flipped: !good };
    const home = battle.homes[i]!;
    if (battle.phase === 'approach') {
      const before = battle.stage.figures[i]!.x;
      const distance = home - before;
      return {
        ...figure,
        x:
          before +
          Math.sign(distance) * Math.min(Math.abs(distance), elapsed * 0.8)
      };
    }
    const direction = good ? 1 : -1;
    const charging = row.option === 'charge' || row.option === 'charged';
    const active = charging || row.option === 'engage';
    const lunge =
      active && fight.round > 0
        ? Math.max(0, Math.sin((vbl + i * 7) / 8)) * (charging ? 40 : 12)
        : 0;
    const retreat = row.option === 'retreat' || row.option === 'withdraw';
    return { ...figure, x: home + direction * (retreat ? -35 : lunge) };
  });
  const arrived = figures.every(
    (figure, i) =>
      figure.frml === SPELL_FLASH || fallen[i] || figure.x === battle.homes[i]
  );
  return {
    ...battle,
    fallen,
    phase: battle.phase === 'fighting' || arrived ? 'fighting' : 'approach',
    stage: { ...stepped, figures },
    vbl
  };
};

export const drawBattle = (
  ctx: CanvasRenderingContext2D,
  assets: AnimationAssets,
  battle: BattleStage
): void => {
  // Fallen figures lie behind the living. Their last frame is rotated
  // about its feet, keeping a fall visible while the round is reported.
  battle.stage.figures.forEach((figure, i) => {
    if (!battle.fallen[i]) {
      return;
    }
    const frame = assets.figures.get(figure.frml)?.frames[figure.frame];
    if (!frame) {
      return;
    }
    ctx.save();
    ctx.translate(figure.x, figure.y + frame.height);
    ctx.rotate(-Math.PI / 2);
    drawFigures(ctx, assets, {
      figures: [{ ...figure, x: 0, y: -frame.height }],
      party: 0
    });
    ctx.restore();
  });
  drawFigures(ctx, assets, {
    ...battle.stage,
    figures: battle.stage.figures.filter((_, i) => !battle.fallen[i])
  });
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
