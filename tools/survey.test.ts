import { describe, expect, test } from 'bun:test';

import {
  shuffleSetup,
  startCampaign,
  stepCampaign,
  type SetupData
} from '../web/src/sim';
import { assetsExist, loadSoakAssets } from './soak';
import { memorisedKnowledge, playCampaign, policyFor } from './strategy';
import {
  DEFAULT_SURVEY,
  KNOWLEDGE_MODES,
  PLAYERS,
  formatSurvey,
  parseSurveyArgs,
  spread,
  survey,
  surveyRun
} from './survey';

test('spreads include missing samples and average the middle pair', () => {
  expect(spread([])).toEqual({ count: 0, max: null, median: null, min: null });
  expect(spread([9, 1, 4])).toEqual({ count: 3, max: 9, median: 4, min: 1 });
  expect(spread([9, 1, 4, 6])).toEqual({ count: 4, max: 9, median: 5, min: 1 });
});

test('the CLI defaults to all Players and both knowledge modes', () => {
  expect(parseSurveyArgs([])).toEqual({
    options: DEFAULT_SURVEY,
    out: undefined
  });
  expect(
    parseSurveyArgs([
      '--players',
      'random,muster',
      '--knowledge',
      'live',
      '--from',
      '10',
      '--seeds',
      '2',
      '--days',
      '20',
      '--out',
      'report.json'
    ])
  ).toEqual({
    options: {
      ...DEFAULT_SURVEY,
      days: 20,
      from: 10,
      knowledge: ['live'],
      players: ['random', 'muster'],
      seeds: 2
    },
    out: 'report.json'
  });
  for (const args of [
    ['--setup', 'other'],
    ['--setup', 'classic,shuffled'],
    ['--setup-seeds', '0'],
    ['--setup-seeds', '1.5'],
    ['--setup-seeds', '4294967297'],
    ['--axes', 'a,c'],
    ['--axes', 'a,a'],
    ['--axes', 'd'],
    ['--seeds', '0'],
    ['--seeds', '1.5'],
    ['--days', 'NaN'],
    ['--from', '-1'],
    ['--from', '4294967295', '--seeds', '2'],
    ['--players', 'unknown'],
    ['--knowledge', ''],
    ['--players', 'random,random'],
    ['--unknown']
  ]) {
    expect(() => parseSurveyArgs(args)).toThrow();
  }
});

describe.skipIf(!assetsExist())('Classic Setup survey', () => {
  test('two seeds, every Player, both modes: report shape and identical results', () => {
    const report = survey(loadSoakAssets(), { ...DEFAULT_SURVEY, seeds: 2 });
    expect(report.setup).toBe('classic');
    expect(report.version).toBe(2);
    expect(report.configurations).toHaveLength(8);
    for (const player of PLAYERS) {
      const configurations = report.configurations.filter(
        config => config.player === player
      );
      expect(configurations.map(config => config.knowledge)).toEqual([
        ...KNOWLEDGE_MODES
      ]);
      expect({ ...configurations[0]!, knowledge: 'live' }).toEqual(
        configurations[1]!
      );
    }
    for (const config of report.configurations) {
      expect(config.runs).toBe(2);
      expect(
        Object.values(config.endings).reduce((sum, count) => sum + count, 0)
      ).toBe(2);
      expect(Object.keys(config.endings).toSorted()).toEqual([
        'day-cap',
        'lost-barad-dur',
        'lost-strongholds',
        'softlock',
        'won-barad-dur',
        'won-mount-doom'
      ]);
      expect(config.wins).toBe(
        config.endings['won-barad-dur'] + config.endings['won-mount-doom']
      );
      expect(config.winRate).toBe(config.wins / config.runs);
      expect(config.failedActs).toBeInteger();
      expect(config.failedActs).toBeGreaterThanOrEqual(0);
      expect(config.finalDay.count).toBe(2);
      expect(config.finalDay.min).toBeLessThanOrEqual(config.finalDay.median!);
      expect(config.finalDay.max).toBeGreaterThanOrEqual(
        config.finalDay.median!
      );
      const { council, mobilisation, warEvents } = config.milestones;
      expect(Object.keys(warEvents)).toEqual(['3', '4', '5', '6', '7']);
      for (const milestone of [
        council,
        mobilisation,
        ...Object.values(warEvents)
      ]) {
        expect(milestone.count).toBeGreaterThanOrEqual(0);
        expect(milestone.count).toBeLessThanOrEqual(2);
        expect(milestone.median === null).toBe(milestone.count === 0);
      }
    }
    const table = formatSurvey(report);
    expect(table).toContain('First mobilisation');
    expect(table).toContain('Failed acts');
    for (const player of PLAYERS) {
      expect(table).toContain(player);
    }
    const json = JSON.stringify(report);
    expect(JSON.parse(json)).toEqual(report);
  });

  test('a day cap is counted separately from a softlock', () => {
    const report = survey(loadSoakAssets(), {
      ...DEFAULT_SURVEY,
      days: 1,
      knowledge: ['live'],
      players: ['random'],
      seeds: 2
    });
    const config = report.configurations[0]!;
    expect(config.endings['day-cap']).toBe(2);
    expect(config.endings.softlock).toBe(0);
    expect(config.finalDay).toEqual({ count: 2, max: 1, median: 1, min: 1 });
    expect(config.milestones.council.count).toBe(0);
  });

  test('wrong memorised object knowledge fails once, then the plan carries on', () => {
    const assets = loadSoakAssets();
    const classic = startCampaign(1, assets).state;
    const remembered = memorisedKnowledge(classic);
    let run = startCampaign(1, assets);
    const sceptreAt = remembered.objectPosition(run.state, 14)!;
    run = {
      ...run,
      state: {
        ...run.state,
        objectPlacements: run.state.objectPlacements.map(slot =>
          slot?.object === 14 ? null : slot
        ),
        roster: run.state.roster.map(entry =>
          entry.index === 7 ? { ...entry, position: sceptreAt } : entry
        )
      }
    };
    const player = policyFor('muster', { openWar: false }, remembered);
    const after = stepCampaign(run, player);
    expect(after.failedActs).toBe(1);
    expect(after.state.roster[7]!.objects).not.toContain(14);
    expect(player.decide(after.state).some(command => 'act' in command)).toBe(
      false
    );
    expect(after.state.roster[7]!.destination).not.toEqual(sceptreAt);
    expect(stepCampaign(after, player).failedActs).toBe(1);
  });

  test('the Token plan uses live object knowledge and plays identically on Classic', () => {
    const assets = loadSoakAssets();
    const classic = startCampaign(1, assets).state;
    const overrides = { openWar: false };
    const live = playCampaign(1, assets, policyFor('muster', overrides), 100);
    const memorised = playCampaign(
      1,
      assets,
      policyFor('muster', overrides, memorisedKnowledge(classic)),
      100
    );
    expect(memorised).toEqual(live);

    const moved = {
      ...classic,
      objectPlacements: classic.objectPlacements.map(slot =>
        slot?.object === 14 ? { ...slot, position: { x: 640, y: 368 } } : slot
      )
    };
    // Put Frodo at the new placement. Only live knowledge attempts Take;
    // memorised knowledge still sends him toward the Classic position.
    moved.roster = moved.roster.map(entry =>
      entry.index === 7 ? { ...entry, position: { x: 640, y: 368 } } : entry
    );
    expect(policyFor('muster', overrides).decide(moved)).toContainEqual({
      act: 'take',
      member: 7,
      object: 14
    });
    expect(
      policyFor('muster', overrides, memorisedKnowledge(classic))
        .decide(moved)
        .some(command => 'act' in command)
    ).toBe(false);
  });

  test('unexpected player exceptions fail the survey', () => {
    expect(() =>
      surveyRun(
        1,
        loadSoakAssets(),
        {
          answer: () => 'continue-on',
          decide: () => {
            throw new Error('broken player');
          }
        },
        400
      )
    ).toThrow('broken player');
  });
});

test('the CLI selects Shuffled Setup, independent counts and axes off', () => {
  expect(
    parseSurveyArgs([
      '--setup',
      'shuffled',
      '--setup-seeds',
      '10',
      '--seeds',
      '100'
    ]).options
  ).toEqual({
    ...DEFAULT_SURVEY,
    seeds: 100,
    setup: 'shuffled',
    setupSeeds: 10
  });
  expect(parseSurveyArgs(['--axes', '']).options.axes).toEqual([]);
  expect(parseSurveyArgs(['--axes', 'b']).options.axes).toEqual(['b']);
  expect(parseSurveyArgs(['--axes', 'a,b']).options.axes).toEqual(['a', 'b']);
});

describe.skipIf(!assetsExist())('Shuffled Setup survey', () => {
  test.each<('a' | 'b')[][]>([[['a']], [['b']], [['a', 'b']]])(
    'crosses both seed ranges, every Player and knowledge mode with axes %j',
    axes => {
      const assets = loadSoakAssets();
      const options = {
        ...DEFAULT_SURVEY,
        axes,
        days: 1,
        seeds: 2,
        setup: 'shuffled' as const,
        setupSeeds: 3
      };
      const report = survey(assets, options);
      expect(report.setup).toBe('shuffled');
      expect(report.configurations).toHaveLength(8);
      for (const config of report.configurations) {
        expect(config.runs).toBe(6);
        expect(config.endings['day-cap']).toBe(6);
        expect(
          Object.values(config.failedActsByAxis).reduce(
            (sum, count) => sum + count,
            0
          )
        ).toBe(config.failedActs);
      }
      // Compare against explicit independent runs, rather than only the count.
      const expectedDays: number[] = [];
      for (let setupSeed = 0; setupSeed < 3; setupSeed++) {
        const runAssets = {
          ...assets,
          startingState: shuffleSetup(
            assets.startingState as SetupData,
            setupSeed,
            axes
          )
        };
        for (let seed = 1; seed <= 2; seed++) {
          expectedDays.push(
            surveyRun(seed, runAssets, policyFor('fellowship'), 1, setupSeed)
              .finalDay
          );
        }
      }
      expect(report.configurations[1]!.finalDay).toEqual(spread(expectedDays));
      expect(formatSurvey(report)).toContain(
        `Setup seeds 0–2; axes ${axes.join(',')}`
      );
      const json = JSON.stringify(report);
      expect(JSON.parse(json)).toEqual(report);
    }
  );

  test('axes off reproduces Classic for each sim seed across Setup seeds', () => {
    const assets = loadSoakAssets();
    const options = {
      ...DEFAULT_SURVEY,
      players: ['fellowship' as const],
      seeds: 2
    };
    const classic = survey(assets, options);
    const shuffled = survey(assets, {
      ...options,
      axes: [],
      setup: 'shuffled',
      setupSeeds: 2
    });
    for (let i = 0; i < classic.configurations.length; i++) {
      const before = classic.configurations[i]!;
      const after = shuffled.configurations[i]!;
      expect(after.winRate).toBe(before.winRate);
      expect(after.finalDay).toEqual({ ...before.finalDay, count: 4 });
      expect(Object.entries(after.endings)).toEqual(
        Object.entries(before.endings).map(([key, value]) => [key, value * 2])
      );
    }
  });

  test('attributes a failed remembered Take, leaving other failures unknown', () => {
    const assets = loadSoakAssets();
    const classic = startCampaign(1, assets).state;
    const remembered = memorisedKnowledge(classic).objectPosition(classic, 14)!;
    const raw = assets.startingState as SetupData & {
      roster: { index: number; position: { x: number; y: number } | null }[];
    };
    const shuffled = shuffleSetup(raw, 0, ['a']);
    const runAssets = {
      ...assets,
      startingState: {
        ...shuffled,
        roster: shuffled.roster.map(entry =>
          entry.index === 7 ? { ...entry, position: remembered } : entry
        )
      }
    };
    const runTake = (multiple: boolean) => {
      let tried = false;
      return surveyRun(
        1,
        runAssets,
        {
          answer: () => 'continue-on',
          decide: () => {
            if (tried) {
              return [];
            }
            tried = true;
            return multiple
              ? [
                  { act: 'take', member: 7, object: 14 },
                  { act: 'use', member: 7, object: 15 }
                ]
              : [{ act: 'take', member: 7, object: 14 }];
          }
        },
        1,
        0,
        classic
      );
    };
    expect(runTake(false).failedActsByAxis).toEqual({
      a: 1,
      b: 0,
      c: 0,
      unattributed: 0
    });
    expect(runTake(true).failedActsByAxis).toEqual({
      a: 0,
      b: 0,
      c: 0,
      unattributed: 2
    });
  });
});
