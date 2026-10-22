import { describe, expect, test } from 'bun:test';

import {
  createSim,
  type Meeting,
  type RosterEntry,
  type SimState
} from '../sim/index';
import type { BattleStage } from './animation-combat';
import type { Stage } from './animation-level';
import { CLOCK_WAIT_MS, SWEEP_MS } from './animation-pace';
import {
  animationProgress,
  enterAnimationLevel,
  pressTalk,
  stepAnimationLevel,
  type AnimationProgress,
  type ProgressHost
} from './animation-progress';
import { startEncounterTalk } from './encounter-talk';
import { newFigure, type ScriptWorld } from './figure-script';
import { WALK_PAST_MS } from './walk-past';

// Every script byte a no-op, so figures stand where they are put.
const world: Omit<ScriptWorld, 'laggardLine'> = {
  frames: () => [{ height: 20, hot_x: 0, hot_y: 20, width: 12 }],
  line1: 1000,
  line2: 1000,
  random: () => 0,
  script: () => Array.from({ length: 256 }, () => 0x60)
};
const figureAt = (x: number, owner = 1) =>
  newFigure({ ...world, laggardLine: 0 }, 0, 0, x, 165, 150, owner);
const walking: Stage = { figures: [figureAt(100)], party: 1 };
const gone: Stage = { figures: [figureAt(340)], party: 1 };

const entry = (index: number, fields: Partial<RosterEntry> = {}): RosterEntry =>
  ({
    allegiance: 1,
    destination: null,
    encounter: null,
    facing: 0,
    fighting: 0,
    figure: 0,
    fraction: 0,
    health: 10,
    icon: 0,
    index,
    isUnit: false,
    leader: null,
    maxHealth: 10,
    maxStamina: 10,
    name: `Entry ${index}`,
    objects: [],
    position: { x: 100, y: 100 },
    route: 0,
    speed: 1,
    stamina: 10,
    state: 0,
    strength: 1,
    ...fields
  }) as RosterEntry;

const world0 = (fields: Partial<SimState> = {}): SimState => ({
  ...createSim(1),
  roster: [entry(0), entry(1, { destination: { x: 400, y: 100 } })],
  ...fields
});

// The browser loop's part, counted.
const host = (sim: SimState, fields: Partial<ProgressHost> = {}) => {
  const calls = { goUp: 0, rebuild: 0, startFight: 0, startTalk: 0, ticks: 0 };
  const fake: ProgressHost & { calls: typeof calls } = {
    afterTick: () => {
      calls.ticks += 1;
      return false;
    },
    calls,
    combatShown: () => true,
    goUp: () => {
      calls.goUp += 1;
    },
    holdsClock: () => false,
    holdsFigures: () => false,
    land: stage => stage,
    party: [1],
    paused: () => false,
    rebuild: () => {
      calls.rebuild += 1;
      return walking;
    },
    sim,
    startFight: () => {
      calls.startFight += 1;
      return { phase: 'approach', stage: { figures: [], party: 0 } } as never;
    },
    startTalk: (meeting: Meeting, stage, lines, now, meets) => {
      calls.startTalk += 1;
      return startEncounterTalk(
        fake.sim.roster[meeting.a]!,
        fake.sim.roster[meeting.b]!,
        stage,
        lines,
        world,
        new Map(),
        new Set(),
        () => 0,
        now,
        meets
      );
    },
    stepCombat: () => {},
    watched: 1,
    world,
    ...fields
  };
  return fake;
};

const on = (stage: Stage): AnimationProgress =>
  enterAnimationLevel(animationProgress(), stage);

describe('Animation Level progression', () => {
  test('releases the watched Character once as its figures walk off, then shows the new scene', () => {
    const fake = host(world0({ watching: 1 }));
    const first = stepAnimationLevel(on(gone), fake, 0, 0);
    expect(first.outcome).toBe('rebuilt');
    expect(fake.calls.rebuild).toBe(1);
    expect(first.progress.stage).toBe(walking);
    const next = stepAnimationLevel(first.progress, fake, 20, 20);
    expect(next.outcome).toBe('stay');
    expect(fake.calls.rebuild).toBe(1);
  });

  test('goes up once the figures walk off with nowhere to go', () => {
    const fake = host(world0({ roster: [entry(0), entry(1)], watching: 1 }));
    expect(stepAnimationLevel(on(gone), fake, 0, 0).outcome).toBe('up');
    expect(fake.calls).toMatchObject({ goUp: 1, rebuild: 0 });
  });

  test('ticks at its own pace, and not while an Encounter walks past', () => {
    const fake = host(world0());
    const passing = { ...on(walking), walkPastUntil: WALK_PAST_MS };
    const held = stepAnimationLevel(passing, fake, 0, CLOCK_WAIT_MS);
    expect(held.outcome).toBe('stay');
    expect(fake.calls.ticks).toBe(0);
    stepAnimationLevel(held.progress, fake, WALK_PAST_MS, CLOCK_WAIT_MS * 2);
    expect(fake.calls.ticks).toBe(2);
  });

  test('a talk with the watched Character holds the clock until it ends', () => {
    const meeting: Meeting = { a: 1, b: 0, kind: 'talk' };
    const fake = host(world0({ meeting }));
    const talking = stepAnimationLevel(on(walking), fake, 0, CLOCK_WAIT_MS);
    expect(fake.sim.meeting).toBeNull();
    expect(fake.calls).toMatchObject({ rebuild: 1, startTalk: 1, ticks: 0 });
    expect(talking.progress.talk).not.toBeNull();
    const held = stepAnimationLevel(talking.progress, fake, 20, CLOCK_WAIT_MS);
    expect(fake.calls.ticks).toBe(0);
    // A press closes the parting, and the talk with it.
    expect(pressTalk(held.progress)).toBe(held.progress);
    const parting = {
      ...held.progress,
      talk: { ...held.progress.talk!, parting: true }
    };
    const ended = pressTalk(parting);
    expect(ended.talk).toBeNull();
    // The talk set both off again: the clock runs at the travelling pace.
    stepAnimationLevel(ended, fake, 40, SWEEP_MS);
    expect(fake.calls.ticks).toBe(1);
  });

  test('a fight the watched Character is not in takes the view up', () => {
    const fight = {
      evil: 0,
      good: 0,
      rows: [{ entries: [0], side: 'good' }]
    } as unknown as SimState['fight'];
    const fake = host(world0({ fight }));
    const result = stepAnimationLevel(on(walking), fake, 0, CLOCK_WAIT_MS);
    expect(result.outcome).toBe('up');
    expect(fake.calls).toMatchObject({ goUp: 1, startFight: 0, ticks: 0 });
  });

  test('a fight on the Level opens its Orders once the approach is over, and ends', () => {
    const fight = {
      evil: 0,
      good: 1,
      rows: [{ entries: [1], side: 'good' }]
    } as unknown as SimState['fight'];
    let fought = 0;
    const fake = host(world0({ fight }), {
      stepCombat: (_now, ended) => {
        fought += ended ? 1 : 0;
        fake.sim = { ...fake.sim, fight: null };
      }
    });
    // Nobody left to walk to their line: the approach is over.
    const battle: BattleStage = {
      ended: false,
      fallen: [],
      members: [],
      phase: 'approach',
      round: 0,
      rows: [],
      stage: { figures: [], party: 0 },
      strengths: [],
      world
    };
    const result = stepAnimationLevel({ ...on(walking), battle }, fake, 0, 0);
    expect(fought).toBe(1);
    expect(result.progress.battle).toBeNull();
    expect(fake.calls.startFight).toBe(0);
  });
});
