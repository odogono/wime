#!/usr/bin/env bun
// The headless soak runner (#222): plays seeded campaigns on the
// Campaign Level with nobody at the controls but a seeded stand-in for
// the player, and checks each one for exceptions, an ending within a
// day cap (a possible softlock otherwise) and that saving and
// restoring at every day boundary gives back an identical state.
//
//   bun tools/soak.ts [--seeds N] [--from SEED] [--days CAP]
//
// The Evil side moves on its own (its Default Orders and triggers). The
// stand-in gives one Good Force a random Order each day, answers
// meetings at random and lets every fight be resolved as ignored.
// Animation Level play is view-side and not soaked.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  LAST_GOOD_ENTRY,
  answerMeeting,
  canOrder,
  closeCouncil,
  createRng,
  createSim,
  giveOrder,
  nextRandom,
  resolveFight,
  restoreSave,
  serialiseSave,
  takeAnnouncement,
  takePassing,
  takesOrder,
  tickSim,
  type MeetingAnswer,
  type RngState,
  type SimState,
  type Tilemap
} from '../web/src/sim';

export interface SoakAssets {
  startingState: unknown;
  tilemap: Tilemap;
}

export type SoakOutcome =
  | { ending: string; kind: 'ending' }
  | { kind: 'crash'; message: string }
  | { kind: 'save-divergence'; message: string }
  | { kind: 'softlock'; message: string };

export interface SoakResult {
  day: number;
  outcome: SoakOutcome;
  seed: number;
  ticks: number;
}

const ANSWERS: MeetingAnswer[] = ['continue-on', 'follow', 'go-there'];

// Ticks without the clock moving before the run is called stuck.
const STALL_TICKS = 10_000;

const ASSETS_DIR = new URL('../web/public/assets/', import.meta.url).pathname;

export const assetsExist = (): boolean =>
  existsSync(join(ASSETS_DIR, 'starting-state.json')) &&
  existsSync(join(ASSETS_DIR, 'campaign/tilemap.json'));

export const loadSoakAssets = (): SoakAssets => ({
  startingState: JSON.parse(
    readFileSync(join(ASSETS_DIR, 'starting-state.json'), 'utf8')
  ),
  tilemap: JSON.parse(
    readFileSync(join(ASSETS_DIR, 'campaign/tilemap.json'), 'utf8')
  ) as Tilemap
});

// The stand-in player's own RNG, kept apart from the sim's so that it
// is not part of the saved state.
const roll = (rng: { state: RngState }, n: number): number => {
  const next = nextRandom(rng.state);
  rng.state = next.state;
  return Math.floor(next.value * n);
};

// One random Order to a Good Force that can take it, toward a random
// Place, through the allegiance roll as the Order window does.
const orderSomeone = (state: SimState, rng: { state: RngState }): SimState => {
  const orderable = state.roster
    .slice(1, LAST_GOOD_ENTRY + 1)
    .filter(entry => canOrder(state, entry.index));
  if (orderable.length === 0 || state.places.length === 0) {
    return state;
  }
  const member = orderable[roll(rng, orderable.length)]!;
  const place = state.places[roll(rng, state.places.length)]!;
  const { taken, world } = takesOrder(state, member.index);
  return taken ? giveOrder(world, member.index, place.position) : world;
};

// Do what the view would do with anything waiting on the player.
const settle = (state: SimState, rng: { state: RngState }): SimState => {
  let next = state;
  while (next.announcements.length > 0) {
    next = takeAnnouncement(next).state;
  }
  while (next.passings.length > 0) {
    next = takePassing(next).state;
  }
  if (next.council) {
    next = closeCouncil(next);
  }
  if (next.meeting) {
    next = answerMeeting(next, ANSWERS[roll(rng, ANSWERS.length)]!).world;
  }
  if (next.fight) {
    next = resolveFight(next);
  }
  return next;
};

// Save and restore, as the save slots do, and report any difference.
const saveRoundTrip = (
  state: SimState,
  tilemap: Tilemap
): { message: string | null; state: SimState } => {
  const data = serialiseSave(state);
  const restored = restoreSave(data, tilemap);
  if (!restored.ok) {
    return { message: `restore refused: ${restored.reason}`, state };
  }
  if (!Bun.deepEquals(restored.state, state, true)) {
    return {
      message: `restored state differs: ${firstDifference(state, restored.state)}`,
      state
    };
  }
  if (serialiseSave(restored.state) !== data) {
    return { message: 'restored state saves differently', state };
  }
  return { message: null, state: restored.state };
};

const firstDifference = (a: unknown, b: unknown, path = 'state'): string => {
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) {
    return '';
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return `${path}: ${String(a)} vs ${String(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const x = (a as Record<string, unknown>)[key];
    const y = (b as Record<string, unknown>)[key];
    if (!(key in b) || !(key in a)) {
      return `${path}.${key}: present on one side only`;
    }
    if (!Bun.deepEquals(x, y, true)) {
      return firstDifference(x, y, `${path}.${key}`) || `${path}.${key}`;
    }
  }
  return path;
};

export const soakRun = (
  seed: number,
  assets: SoakAssets,
  dayCap: number
): SoakResult => {
  const rng = { state: createRng(seed ^ 0x5a_5a_5a_5a) };
  let state: SimState | null = null;
  let ticks = 0;
  const result = (outcome: SoakOutcome): SoakResult => ({
    day: state?.clock.day ?? 0,
    outcome,
    seed,
    ticks
  });
  try {
    state = createSim(seed, assets.startingState, assets.tilemap);
    const lastDay = state.clock.day + dayCap;
    let day = state.clock.day;
    let stalled = 0;
    let clock = JSON.stringify(state.clock);
    while (!state.ending) {
      if (state.clock.day >= lastDay) {
        return result({
          kind: 'softlock',
          message: `no ending within ${dayCap} days`
        });
      }
      if (state.clock.day !== day) {
        day = state.clock.day;
        const trip = saveRoundTrip(state, assets.tilemap);
        if (trip.message) {
          return result({ kind: 'save-divergence', message: trip.message });
        }
        state = orderSomeone(trip.state, rng);
      }
      state = settle(tickSim(state), rng);
      ticks++;
      const now = JSON.stringify(state.clock);
      stalled = now === clock ? stalled + 1 : 0;
      clock = now;
      if (stalled >= STALL_TICKS && !state.ending) {
        return result({
          kind: 'softlock',
          message: `clock stuck at ${clock} for ${STALL_TICKS} ticks`
        });
      }
    }
    return result({ ending: JSON.stringify(state.ending), kind: 'ending' });
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    return result({ kind: 'crash', message });
  }
};

export const summarise = (results: SoakResult[]): string => {
  const lines: string[] = [];
  const counts = new Map<string, number>();
  for (const { outcome } of results) {
    const key =
      outcome.kind === 'ending' ? `ending ${outcome.ending}` : outcome.kind;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  lines.push(`${results.length} runs`);
  for (const [key, count] of [...counts].toSorted()) {
    lines.push(`  ${key}: ${count}`);
  }
  const days = results.map(r => r.day).toSorted((a, b) => a - b);
  if (days.length > 0) {
    lines.push(
      `  final day: min ${days[0]}, median ${days[Math.floor(days.length / 2)]}, max ${days.at(-1)}`
    );
  }
  for (const r of results) {
    if (r.outcome.kind !== 'ending') {
      lines.push(
        `seed ${r.seed} ${r.outcome.kind} on day ${r.day}: ${r.outcome.message.split('\n')[0]}`
      );
    }
  }
  return lines.join('\n');
};

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      days: { default: '400', type: 'string' },
      from: { default: '1', type: 'string' },
      seeds: { default: '50', type: 'string' }
    }
  });
  if (!assetsExist()) {
    console.error('web/public/assets/ is missing: run `bun run extract-all`');
    process.exit(2);
  }
  const assets = loadSoakAssets();
  const from = Number(values.from);
  const results: SoakResult[] = [];
  for (let seed = from; seed < from + Number(values.seeds); seed++) {
    const run = soakRun(seed, assets, Number(values.days));
    results.push(run);
    console.log(
      `seed ${seed}: ${run.outcome.kind === 'ending' ? run.outcome.ending : run.outcome.kind} (day ${run.day}, ${run.ticks} ticks)`
    );
  }
  console.log(`\n${summarise(results)}`);
  process.exit(results.every(r => r.outcome.kind === 'ending') ? 0 : 1);
}
