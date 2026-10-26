import { describe, expect, test } from 'bun:test';

import { startCampaign, stepCampaign } from '../web/src/sim';
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
      days: 20,
      from: 10,
      knowledge: ['live'],
      players: ['random', 'muster'],
      seeds: 2
    },
    out: 'report.json'
  });
  for (const args of [
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
    expect(report.version).toBe(1);
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
