import { describe, expect, test } from 'bun:test';

import { orderedWay, wayOf } from '../web/src/sim/movement';
import { restoreSave, serialiseSave } from '../web/src/sim/save';
import { hostFor, setTextTable } from '../web/src/sim/scripted/host';
import { setSimRules } from '../web/src/sim/state';
import { WAR_EVENT_MESSAGES } from '../web/src/sim/war-events';
import {
  comparable,
  firstDiff,
  loadAssets,
  loadTextTable,
  playBoth,
  startGame,
  step,
  type Game
} from './scripted-differential';

// The spike's checks (#194), short enough for `bun run check`; the full
// 30-day matrix is `bun tools/scripted-differential.ts`. They need the
// exported assets, absent in CI.
const assets = loadAssets();

const GAMES: Game[] = [
  { movementRule: 'classic', seed: 1, setupSeed: null },
  { movementRule: 'crossing', seed: 1, setupSeed: null },
  { movementRule: 'classic', seed: 2, setupSeed: 7 },
  { movementRule: 'crossing', seed: 2, setupSeed: 7 }
];

// A scripted tick may take seconds when many Forces choose a Crossing.
const SLOW = 600_000;

// A Query asked under one set of rules.
const ask = <T>(rules: 'scripted' | 'typescript', query: () => T): T => {
  setSimRules(rules);
  try {
    return query();
  } finally {
    setSimRules('typescript');
  }
};

const name = (game: Game): string =>
  `${game.movementRule} movement, ${
    game.setupSeed === null
      ? 'the Classic Setup'
      : `Setup seed ${game.setupSeed}`
  }, seed ${game.seed}`;

describe.skipIf(!assets)('the scripted sim against the TypeScript sim', () => {
  for (const game of GAMES) {
    test(
      `plays a day the same, ${name(game)}`,
      () => {
        const played = playBoth(startGame(assets!, game), 1);
        expect(played.divergence?.diff ?? null).toBeNull();
      },
      SLOW
    );
  }

  test(
    'round-trips a save made mid-campaign through save.ts',
    () => {
      const game = GAMES[1]!;
      let scripted = startGame(assets!, game);
      for (let i = 0; i < 200; i++) {
        scripted = step(scripted, 'scripted');
      }
      const restored = restoreSave(
        serialiseSave(scripted),
        assets!.terrain,
        assets!.waterways
      );
      if (!restored.ok) {
        throw new Error('the save did not load');
      }
      expect(
        firstDiff(comparable(restored.state), comparable(scripted))
      ).toBeNull();
      let again = restored.state;
      for (let i = 0; i < 200; i++) {
        scripted = step(scripted, 'scripted');
        again = step(again, 'scripted');
      }
      expect(firstDiff(comparable(again), comparable(scripted))).toBeNull();
    },
    SLOW
  );

  test(
    'plays on from a save the TypeScript sim made',
    () => {
      let typescript = startGame(assets!, GAMES[1]!);
      for (let i = 0; i < 200; i++) {
        typescript = step(typescript, 'typescript');
      }
      expect(Object.keys(typescript.crossingLegs).length).toBeGreaterThan(0);
      const restored = restoreSave(
        serialiseSave(typescript),
        assets!.terrain,
        assets!.waterways
      );
      if (!restored.ok) {
        throw new Error('the save did not load');
      }
      let scripted = restored.state;
      for (let i = 0; i < 200; i++) {
        typescript = step(typescript, 'typescript');
        scripted = step(scripted, 'scripted');
        expect(
          firstDiff(comparable(typescript), comparable(scripted))
        ).toBeNull();
      }
      expect(scripted.crossingLegs).toEqual({});
    },
    SLOW
  );

  test(
    'answers the Way Queries as the TypeScript sim does',
    () => {
      let sim = startGame(assets!, GAMES[1]!);
      for (let i = 0; i < 300; i++) {
        sim = step(sim, 'scripted');
      }
      // The TypeScript Queries read the legs from the core state.
      const typescript = { ...sim, crossingLegs: sim.scenario!.crossingLegs };
      for (let index = 0; index < sim.roster.length; index++) {
        expect(ask('scripted', () => wayOf(sim, index))).toEqual(
          ask('typescript', () => wayOf(typescript, index))
        );
      }
      for (const click of [
        { x: 1500, y: 450 },
        { x: 900, y: 900 },
        { x: 1800, y: 1100 }
      ]) {
        for (const member of [1, 7, 26]) {
          expect(ask('scripted', () => orderedWay(sim, member, click))).toEqual(
            ask('typescript', () => orderedWay(typescript, member, click))
          );
        }
      }
    },
    SLOW
  );

  test('reads the War Event messages by text ID', () => {
    const table = loadTextTable();
    if (!table) {
      return;
    }
    setTextTable(table);
    const host = hostFor(startGame(assets!, GAMES[0]!));
    expect(host.textOf('code+0x0e2c1')).toBe(WAR_EVENT_MESSAGES[4]);
    expect(host.textOf('code+0x0e2e1')).toBe(WAR_EVENT_MESSAGES[7]);
    expect(() => host.textOf('code+0x00000')).toThrow('unknown text');
  });
});
