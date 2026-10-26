#!/usr/bin/env bun
// Classic Setup baseline (#271). Each configuration plays the same seed
// range through the campaign driver, with fresh Player state per run.
//
// bun run survey [--seeds N] [--from SEED] [--days CAP]
//                [--players fellowship,muster,defensive,random]
//                [--knowledge memorised,live] [--out report.json]
//
// Days are absolute campaign days, as in runToEnd. Spreads are min,
// median (the mean of the middle pair for even samples), and max.
// Milestone counts exclude campaigns where that milestone never occurred.
// Failed acts are object commands with no effect; allegiance refusals
// are ordinary play and are excluded. No win-rate threshold is enforced.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  campaignMilestones,
  isGoodVictory,
  runToEnd,
  sameClock,
  startCampaign,
  stepCampaign,
  type Ending,
  type Milestones,
  type Player
} from '../web/src/sim';
import {
  assetsExist,
  loadSoakAssets,
  randomPlayer,
  type SoakAssets
} from './soak';
import { LIVE_KNOWLEDGE, memorisedKnowledge, policyFor } from './strategy';

export const PLAYERS = ['fellowship', 'muster', 'defensive', 'random'] as const;
export const KNOWLEDGE_MODES = ['memorised', 'live'] as const;
const WAR_EVENTS = [3, 4, 5, 6, 7] as const;
const STALL_STEPS = 10_000;

export type SurveyPlayer = (typeof PLAYERS)[number];
export type KnowledgeMode = (typeof KNOWLEDGE_MODES)[number];
export type SurveyOutcome = Ending | 'day-cap' | 'softlock';

export interface SurveyOptions {
  days: number;
  from: number;
  knowledge: KnowledgeMode[];
  players: SurveyPlayer[];
  seeds: number;
}

export const DEFAULT_SURVEY: SurveyOptions = {
  days: 400,
  from: 1,
  knowledge: [...KNOWLEDGE_MODES],
  players: [...PLAYERS],
  seeds: 50
};

export interface SurveyRun {
  failedActs: number;
  finalDay: number;
  milestones: Milestones;
  outcome: SurveyOutcome;
  seed: number;
}

export interface Spread {
  count: number;
  max: number | null;
  median: number | null;
  min: number | null;
}

export interface SurveyConfiguration {
  endings: Record<SurveyOutcome, number>;
  failedActs: number;
  finalDay: Spread;
  knowledge: KnowledgeMode;
  milestones: {
    council: Spread;
    mobilisation: Spread;
    warEvents: Record<(typeof WAR_EVENTS)[number], Spread>;
  };
  player: SurveyPlayer;
  runs: number;
  winRate: number;
  wins: number;
}

export interface SurveyReport {
  configurations: SurveyConfiguration[];
  options: SurveyOptions;
  setup: 'classic';
  version: 1;
}

const SOFTLOCK = new Error('the campaign clock stopped moving');

// Kept separate from aggregation so a capped or stalled campaign can be
// inspected by seed. Unexpected exceptions fail the tool, not the win rate.
export const surveyRun = (
  seed: number,
  assets: SoakAssets,
  player: Player,
  dayCap: number
): SurveyRun => {
  let run = startCampaign(seed, assets);
  let stalled = 0;
  let softlock = false;
  try {
    run = runToEnd(
      run,
      before => {
        run = stepCampaign(before, player);
        stalled = sameClock(before.state.clock, run.state.clock)
          ? stalled + 1
          : 0;
        if (stalled >= STALL_STEPS && !run.state.ending) {
          throw SOFTLOCK;
        }
        return run;
      },
      dayCap
    );
  } catch (error) {
    if (error !== SOFTLOCK) {
      throw error;
    }
    softlock = true;
  }
  return {
    failedActs: run.failedActs,
    finalDay: run.state.clock.day,
    milestones: campaignMilestones(run),
    outcome: run.state.ending ?? (softlock ? 'softlock' : 'day-cap'),
    seed
  };
};

export const spread = (values: number[]): Spread => {
  const sorted = values.toSorted((a, b) => a - b);
  const count = sorted.length;
  return {
    count,
    max: sorted.at(-1) ?? null,
    median: count
      ? (sorted[Math.floor((count - 1) / 2)]! +
          sorted[Math.floor(count / 2)]!) /
        2
      : null,
    min: sorted[0] ?? null
  };
};

const summarise = (
  player: SurveyPlayer,
  knowledge: KnowledgeMode,
  runs: SurveyRun[]
): SurveyConfiguration => {
  const endings: Record<SurveyOutcome, number> = {
    'day-cap': 0,
    'lost-barad-dur': 0,
    'lost-strongholds': 0,
    softlock: 0,
    'won-barad-dur': 0,
    'won-mount-doom': 0
  };
  for (const run of runs) {
    endings[run.outcome]++;
  }
  const wins = runs.filter(run =>
    run.outcome !== 'day-cap' && run.outcome !== 'softlock'
      ? isGoodVictory(run.outcome)
      : false
  ).length;
  const eventDays = (event: number): Spread =>
    spread(
      runs.flatMap(run =>
        run.milestones.warEvents
          .filter(noted => noted.event === event)
          .map(noted => noted.day)
      )
    );
  return {
    endings,
    failedActs: runs.reduce((sum, run) => sum + run.failedActs, 0),
    finalDay: spread(runs.map(run => run.finalDay)),
    knowledge,
    milestones: {
      council: spread(runs.flatMap(run => run.milestones.council ?? [])),
      mobilisation: spread(
        runs.flatMap(run => run.milestones.mobilisation?.day ?? [])
      ),
      warEvents: {
        3: eventDays(3),
        4: eventDays(4),
        5: eventDays(5),
        6: eventDays(6),
        7: eventDays(7)
      }
    },
    player,
    runs: runs.length,
    winRate: wins / runs.length,
    wins
  };
};

export const survey = (
  assets: SoakAssets,
  options: SurveyOptions = DEFAULT_SURVEY
): SurveyReport => {
  validateOptions(options);
  const classic = startCampaign(0, assets).state;
  const configurations: SurveyConfiguration[] = [];
  for (const player of options.players) {
    for (const mode of options.knowledge) {
      const knowledge =
        mode === 'memorised' ? memorisedKnowledge(classic) : LIVE_KNOWLEDGE;
      const runs: SurveyRun[] = [];
      for (
        let seed = options.from;
        seed < options.from + options.seeds;
        seed++
      ) {
        const policy =
          player === 'random'
            ? randomPlayer(seed)
            : policyFor(player, {}, knowledge);
        runs.push(surveyRun(seed, assets, policy, options.days));
      }
      configurations.push(summarise(player, mode, runs));
    }
  }
  return { configurations, options, setup: 'classic', version: 1 };
};

const integer = (name: string, value: number, min: number): void => {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
};

const validateOptions = (options: SurveyOptions): void => {
  integer('seeds', options.seeds, 1);
  integer('from', options.from, 0);
  integer('days', options.days, 1);
  // The sim RNG is 32-bit: do not silently survey repeated seeds.
  if (options.from + options.seeds - 1 > 0xff_ff_ff_ff) {
    throw new Error('the seed range must fit in an unsigned 32-bit integer');
  }
  selections(options.players.join(','), PLAYERS, 'players');
  selections(options.knowledge.join(','), KNOWLEDGE_MODES, 'knowledge');
};

const selections = <T extends string>(
  value: string,
  choices: readonly T[],
  name: string
): T[] => {
  const selected = value.split(',');
  if (
    selected.length === 0 ||
    selected.some(item => !choices.includes(item as T)) ||
    new Set(selected).size !== selected.length
  ) {
    throw new Error(
      `${name} must select unique values from ${choices.join(',')}`
    );
  }
  return selected as T[];
};

export const parseSurveyArgs = (
  args: string[]
): { options: SurveyOptions; out: string | undefined } => {
  const { values } = parseArgs({
    args,
    options: {
      days: { default: String(DEFAULT_SURVEY.days), type: 'string' },
      from: { default: String(DEFAULT_SURVEY.from), type: 'string' },
      knowledge: { default: KNOWLEDGE_MODES.join(','), type: 'string' },
      out: { type: 'string' },
      players: { default: PLAYERS.join(','), type: 'string' },
      seeds: { default: String(DEFAULT_SURVEY.seeds), type: 'string' }
    }
  });
  const options: SurveyOptions = {
    days: Number(values.days),
    from: Number(values.from),
    knowledge: selections(values.knowledge, KNOWLEDGE_MODES, 'knowledge'),
    players: selections(values.players, PLAYERS, 'players'),
    seeds: Number(values.seeds)
  };
  validateOptions(options);
  return { options, out: values.out };
};

const table = (rows: string[][]): string => {
  const widths = rows[0]!.map((_, col) =>
    Math.max(...rows.map(row => row[col]!.length))
  );
  return rows
    .map(row => row.map((cell, col) => cell.padEnd(widths[col]!)).join(' | '))
    .join('\n');
};

const days = ({ count, max, median, min }: Spread): string =>
  median === null ? '— (0)' : `${median} [${min},${max}] (${count})`;

export const formatSurvey = (report: SurveyReport): string => {
  const configurations = report.configurations;
  return [
    `Classic Setup, seeds ${report.options.from}–${report.options.from + report.options.seeds - 1}, day cap ${report.options.days}`,
    table([
      [
        'Player',
        'Knowledge',
        'Runs',
        'Wins',
        'Win rate',
        'Mount Doom',
        'Barad-dûr',
        'Lost Ring',
        'Strongholds',
        'Day cap',
        'Softlock',
        'Final day',
        'Failed acts'
      ],
      ...configurations.map(config => [
        config.player,
        config.knowledge,
        String(config.runs),
        String(config.wins),
        `${(config.winRate * 100).toFixed(2)}%`,
        String(config.endings['won-mount-doom']),
        String(config.endings['won-barad-dur']),
        String(config.endings['lost-barad-dur']),
        String(config.endings['lost-strongholds']),
        String(config.endings['day-cap']),
        String(config.endings.softlock),
        days(config.finalDay),
        String(config.failedActs)
      ])
    ]),
    'Days: median [min,max] (number observed); — means never observed.',
    table([
      [
        'Player',
        'Knowledge',
        'Council',
        'First mobilisation',
        ...WAR_EVENTS.map(event => `War ${event}`)
      ],
      ...configurations.map(config => [
        config.player,
        config.knowledge,
        days(config.milestones.council),
        days(config.milestones.mobilisation),
        ...WAR_EVENTS.map(event => days(config.milestones.warEvents[event]))
      ])
    ]),
    'Failed acts: object commands with no effect; allegiance refusals excluded.'
  ].join('\n\n');
};

if (import.meta.main) {
  const { options, out } = parseSurveyArgs(process.argv.slice(2));
  if (!assetsExist()) {
    console.error('web/public/assets/ is missing: run `bun run extract-all`');
    process.exit(2);
  }
  const report = survey(loadSoakAssets(), options);
  console.log(formatSurvey(report));
  if (out) {
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  }
}
