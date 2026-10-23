#!/usr/bin/env bun
// The headless strategy player (#243): plays a whole campaign through
// the same sim API as the soak runner (tools/soak.ts), but with a
// policy in place of its random stand-in, and records what it did as
// a demo script that replays to the same ending.
//
//   bun tools/strategy.ts [--plan fellowship|muster|defensive] [--seeds N]
//                         [--from SEED] [--write]
//
// Three plans win:
//
// - fellowship: the Ring to Mount Doom. Frodo collects Merry and
//   Aragorn on the way to Rivendell, dodging the Nazgûl, for the
//   Council; then Gandalf leads the Fellowship by Lórien and North
//   Ithilien and charges Mount Doom.
// - muster: Barad-dûr's Garrison destroyed. The same road to the
//   Council; then Frodo stays at Rivendell with the Ring, out of the
//   war, and Faramir steps onto the Mordor tripwire to start it at
//   once (finding:ai-good-force-near-mordor-starts-the-war). That
//   mobilises Gondor, the Dwarves and the Elves while Mordor's hosts
//   are still in their holds (docs/spec/war-events.md). Gandalf makes
//   for Edoras to rouse Théoden, and every Force under the player's
//   command gathers north of Mordor, short of the tripwire. Once enough
//   strength stands there, they march on Barad-dûr, and the Forces
//   still coming follow as they arrive.
// - defensive: the Ring to Mount Doom while the Strongholds hold. The
//   same road to the Council; then the Fellowship hides in Lórien
//   until the Dark Lord's armies march (War Event 7, day 169;
//   docs/spec/war-events.md) and goes by North Ithilien to Mount Doom
//   behind them. Saruman's march mobilises Rohan and Gondor at the Isen
//   Ford (finding:mobilisation-evil-at-the-fords-of-isen), and each of
//   their Forces holds the nearest of Minas Tirith, the Hornburg and
//   Edoras, so the Strongholds' Garrisons stand sieges.
//
// The policy plays as a player can: it reads only what the Campaign
// Level shows (its own Forces, the awake Evil Forces on the map and
// the terrain), gives Orders through the allegiance roll as the Order
// window does, and answers meetings. Fights are resolved as ignored.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';

import {
  BARAD_DUR,
  BARAD_DUR_GARRISON,
  INITIAL_WAR_EVENTS,
  LAST_GOOD_ENTRY,
  QUARTER_HOURS_PER_DAY,
  RIVENDELL,
  answerMeeting,
  canOrder,
  closeCouncil,
  createSim,
  destinationForClick,
  giveOrder,
  hasWarEvent,
  resolveFight,
  takeAnnouncement,
  takePassing,
  takesOrder,
  terrainAt,
  tickSim,
  topLeader,
  type Clock,
  type Ending,
  type Meeting,
  type MeetingAnswer,
  type Point,
  type RosterEntry,
  type SimState
} from '../web/src/sim';
import { assetsExist, loadSoakAssets, type SoakAssets } from './soak';

export const DEMO_VERSION = 1;

export const DEMOS_DIR = new URL('../web/public/demos/', import.meta.url)
  .pathname;

export type PlanName = 'defensive' | 'fellowship' | 'muster';

// One player input, applied at a clock time. Orders are applied at the
// first decision point of their quarter-hour, in the listed order, each
// through the allegiance roll. A meeting answer is matched to the
// meeting it answers; meetings not listed are answered "Continue on",
// as the window does when it times out.
export type DemoInput =
  | { at: Clock; kind: 'order'; member: number; to: Point }
  | { answer: MeetingAnswer; at: Clock; kind: 'answer'; meeting: Meeting };

export interface Milestones {
  // The day the Council was held, before it moved the calendar on.
  council: number | null;
  // The first Leader the War Events or a trigger put under the
  // player's command, and the day.
  mobilisation: { day: number; leader: string } | null;
  // War Events 3 to 7, in the order they were set, with their days.
  warEvents: { day: number; event: number }[];
}

export interface DemoScript {
  ending: Ending | null;
  finalDay: number;
  inputs: DemoInput[];
  milestones: Milestones;
  plan: PlanName;
  seed: number;
  version: number;
}

const FRODO = 7;
const GANDALF = 1;
const FARAMIR = 15;
const THEODEN = 26;
const FIRST_EVIL = LAST_GOOD_ENTRY + 1;
const LAST_FORCE = 151;
const TILE = 16;

// The tripwire's corner: a non-Evil Leader on a tile origin at or
// beyond it sets War Event 7
// (finding:ai-good-force-near-mordor-starts-the-war).
const MORDOR_CORNER: Point = { x: 1664, y: 1008 };

// A Force does not keep to its planned tiles exactly (its steering
// takes a neighbour now and then), so routes keep this far clear.
const MORDOR_MARGIN = 2 * 16;

const nearMordor = (p: Point): boolean =>
  p.x >= MORDOR_CORNER.x - MORDOR_MARGIN &&
  p.y >= MORDOR_CORNER.y - MORDOR_MARGIN;

const same = (a: Point | null, b: Point | null): boolean =>
  a !== null && b !== null && a.x === b.x && a.y === b.y;

const place = (state: SimState, name: string): Point => {
  const found = state.places.find(candidate => candidate.name === name);
  if (!found) {
    throw new Error(`no Place named ${name}`);
  }
  return found.position;
};

// The Evil Forces the Campaign Level shows: awake Leaders on the map.
const visibleEvil = (state: SimState): RosterEntry[] =>
  state.roster
    .slice(FIRST_EVIL, LAST_FORCE + 1)
    .filter(
      entry =>
        entry.state !== 0 &&
        entry.leader === null &&
        entry.position !== null &&
        entry.strength > 0
    );

const chebyshev = (a: Point, b: Point): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// --- Route planning over the visible terrain -------------------------

interface RouteOptions {
  // Keep out of the tripwire's corner.
  avoidMordor: boolean;
  // Tiles within this many pixels of a visible Evil Force are closed,
  // except the goal's.
  keepClear: number;
}

// The cheapest tile path from one tile origin to another, by the
// terrain's pace (docs/spec/movement.md), as tile origins. A player
// reads the same from the map's colours.
export const planRoute = (
  state: SimState,
  from: Point,
  to: Point,
  options: RouteOptions
): Point[] | null => {
  const width = state.tilemap?.width ?? 0;
  const height = state.tilemap?.height ?? 0;
  const start = destinationForClick(from);
  const goal = destinationForClick(to);
  const id = (x: number, y: number): number => y * width + x;
  // Tiles closed to the route: the tripwire's corner, and those near
  // a visible Evil Force. The start and goal stay open.
  const blocked = new Uint8Array(width * height);
  if (options.avoidMordor) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (nearMordor({ x: x * TILE, y: y * TILE })) {
          blocked[id(x, y)] = 1;
        }
      }
    }
  }
  const reach = Math.floor(options.keepClear / TILE);
  // The Forces at the goal are what the route is for.
  for (const entry of visibleEvil(state).filter(
    candidate => chebyshev(candidate.position!, goal) > options.keepClear
  )) {
    const ex = Math.round(entry.position!.x / TILE);
    const ey = Math.round(entry.position!.y / TILE);
    for (let y = ey - reach; y <= ey + reach; y++) {
      for (let x = ex - reach; x <= ex + reach; x++) {
        if (x >= 0 && y >= 0 && x < width && y < height) {
          blocked[id(x, y)] = 1;
        }
      }
    }
  }
  blocked[id(start.x / TILE, start.y / TILE)] = 0;
  blocked[id(goal.x / TILE, goal.y / TILE)] = 0;
  const closed = (x: number, y: number): boolean => blocked[id(x, y)] === 1;
  const cost = new Float64Array(width * height).fill(Infinity);
  const previous = new Int32Array(width * height).fill(-1);
  const done = new Uint8Array(width * height);
  // A binary heap of [cost, tile].
  const heap: [number, number][] = [];
  const push = (item: [number, number]): void => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]![0] <= heap[i]![0]) {
        break;
      }
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) {
          m = l;
        }
        if (r < heap.length && heap[r]![0] < heap[m]![0]) {
          m = r;
        }
        if (m === i) {
          break;
        }
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  const sx = start.x / TILE;
  const sy = start.y / TILE;
  const gx = goal.x / TILE;
  const gy = goal.y / TILE;
  cost[id(sx, sy)] = 0;
  push([0, id(sx, sy)]);
  while (heap.length > 0) {
    const [c, at] = pop();
    if (done[at]) {
      continue;
    }
    done[at] = 1;
    const x = at % width;
    const y = Math.floor(at / width);
    if (x === gx && y === gy) {
      break;
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (
          (dx === 0 && dy === 0) ||
          nx < 0 ||
          ny < 0 ||
          nx >= width ||
          ny >= height ||
          closed(nx, ny)
        ) {
          continue;
        }
        const terrain = terrainAt(state, { x: nx * TILE, y: ny * TILE });
        if (terrain <= 0) {
          continue;
        }
        const step = ((dx && dy ? Math.SQRT2 : 1) * 100) / terrain;
        const n = id(nx, ny);
        if (c + step < cost[n]!) {
          cost[n] = c + step;
          previous[n] = at;
          push([c + step, n]);
        }
      }
    }
  }
  if (!done[id(gx, gy)]) {
    return null;
  }
  const path: Point[] = [];
  for (let at = id(gx, gy); at !== -1; at = previous[at]!) {
    path.push({ x: (at % width) * TILE, y: Math.floor(at / width) * TILE });
  }
  return path.toReversed();
};

// Waypoints along a path: every `stride` tiles, and the end.
const waypoints = (path: Point[], stride: number): Point[] => {
  const points = path.filter((_, i) => i > 0 && i % stride === 0);
  if (!same(points.at(-1) ?? null, path.at(-1) ?? null)) {
    points.push(path.at(-1)!);
  }
  return points;
};

// --- Policies ---------------------------------------------------------

export interface Command {
  member: number;
  to: Point;
}

export interface Policy {
  answer: (state: SimState, meeting: Meeting) => MeetingAnswer;
  // Called once per quarter-hour, when nothing waits on the player.
  decide: (state: SimState) => Command[];
}

export interface PlanOptions {
  // How near, in pixels, a moving Evil Force may come to the
  // Ring-bearer's Force before it turns away.
  fleeRadius: number;
}

export const DEFAULT_OPTIONS: PlanOptions = { fleeRadius: 96 };

// The Ring-bearer's Force's Leader.
const ringLeader = (state: SimState): RosterEntry =>
  topLeader(state.roster, state.roster[state.ringBearer ?? FRODO]!);

// A command toward `to`, unless the Leader already stands there or is
// already bound there.
const toward = (state: SimState, member: number, to: Point): Command | null => {
  const entry = state.roster[member]!;
  const destination = destinationForClick(to);
  if (
    !canOrder(state, member) ||
    same(entry.position, destination) ||
    same(entry.destination, destination)
  ) {
    return null;
  }
  return { member, to: destination };
};

// Walks a Leader through named Places one after the other, turning away
// from moving Evil Forces (the Nazgûl, Encounters on the road) and
// from any Evil Force close by. With `charge` set, the last leg goes
// straight on whatever is in the way.
const placeWalker = (
  names: string[],
  options: PlanOptions & { chargeLastLeg: boolean }
) => {
  let leg = 0;
  return (state: SimState, leader: RosterEntry): Command | null => {
    const at = leader.position!;
    while (leg < names.length - 1 && same(at, place(state, names[leg]!))) {
      leg++;
    }
    const goal = place(state, names[leg]!);
    if (same(at, goal)) {
      return null;
    }
    const charging = options.chargeLastLeg && leg === names.length - 1;
    const threats = charging
      ? []
      : visibleEvil(state).filter(
          entry =>
            chebyshev(entry.position!, at) <=
            (entry.state === 1 && entry.destination ? options.fleeRadius : 24)
        );
    if (threats.length === 0) {
      return toward(state, leader.index, goal);
    }
    // Away from the threats, nearer ones counting for more.
    let vx = 0;
    let vy = 0;
    for (const threat of threats) {
      const dx = at.x - threat.position!.x;
      const dy = at.y - threat.position!.y;
      const d2 = dx * dx + dy * dy || 1;
      vx += dx / d2;
      vy += dy / d2;
    }
    const n = Math.hypot(vx, vy) || 1;
    return toward(state, leader.index, {
      x: Math.round(at.x + (vx / n) * 48),
      y: Math.round(at.y + (vy / n) * 48)
    });
  };
};

// Before the Council: Frodo by Buckland and Bree, where Merry and
// Aragorn join him, to Rivendell, where Gandalf waits.
const TO_RIVENDELL = ['BUCKLAND', 'BREE', 'RIVENDELL'];

const followWhileQuesting = (
  state: SimState,
  meeting: Meeting
): MeetingAnswer =>
  meeting.kind === 'follow' && state.councilPending ? 'follow' : 'continue-on';

export const fellowshipPolicy = (
  options: PlanOptions = DEFAULT_OPTIONS
): Policy => {
  const toRivendell = placeWalker(TO_RIVENDELL, {
    ...options,
    chargeLastLeg: false
  });
  const toMountDoom = placeWalker(['LORIEN', 'NORTH ITHILIEN', 'MT. DOOM'], {
    ...options,
    chargeLastLeg: true
  });
  return {
    answer: followWhileQuesting,
    decide: state => {
      const leader = ringLeader(state);
      const walk = state.councilPending ? toRivendell : toMountDoom;
      const command = walk(state, leader);
      return command ? [command] : [];
    }
  };
};

export interface MusterOptions extends PlanOptions {
  // The last day to wait for the muster before striking anyway.
  latestStrike: number;
  // Start the war straight after the Council: Faramir steps onto the
  // tripwire, which mobilises Gondor, the Dwarves and the Elves
  // (docs/spec/war-events.md).
  openWar: boolean;
  // Where the hosts gather, short of the tripwire.
  rally: Point;
  // The strength that must stand at the rally to strike.
  ready: number;
}

export const DEFAULT_MUSTER: MusterOptions = {
  ...DEFAULT_OPTIONS,
  latestStrike: 140,
  openWar: true,
  rally: { x: 1792, y: 976 },
  ready: 8000
};

// Clearance, in pixels, that marching routes keep from visible Evil
// Forces; the spacing of their waypoints, in tiles; and how long, in
// quarter-hours, a Leader off its route waits for a new one.
const KEEP_CLEAR = 32;
const WAYPOINT_STRIDE = 6;
const REPLAN_AFTER = 16;

// The Good strength in the Forces whose Leaders stand at a point, as
// the Campaign Level's Force window shows it.
const strengthAt = (state: SimState, point: Point): number =>
  state.roster
    .slice(1, LAST_GOOD_ENTRY + 1)
    .filter(
      entry =>
        entry.state !== 0 &&
        same(topLeader(state.roster, entry).position, point)
    )
    .reduce((sum, entry) => sum + entry.strength, 0);

// Leads Leaders along planned routes: the next waypoint on the way to
// `goal` for one Leader, planning its route, and planning again when
// it strays off.
const router = () => {
  const routes = new Map<
    number,
    { goal: string; planned: number; points: Point[] }
  >();
  return (
    state: SimState,
    leader: RosterEntry,
    goal: Point,
    avoidMordor: boolean
  ): Command | null => {
    const key = `${goal.x},${goal.y},${avoidMordor}`;
    let route = routes.get(leader.index);
    const at = leader.position!;
    if (same(at, destinationForClick(goal))) {
      return null;
    }
    if (route?.goal === key) {
      const reached = route.points.findIndex(p => same(p, at));
      if (reached !== -1) {
        route.points = route.points.slice(reached + 1);
      }
    }
    const now =
      state.clock.day * QUARTER_HOURS_PER_DAY + state.clock.quarterHour;
    const strayed =
      route !== undefined &&
      (route.points.length === 0 ||
        (leader.destination !== null &&
          !same(leader.destination, route.points[0]!)));
    if (
      !route ||
      route.goal !== key ||
      (strayed && now - route.planned >= REPLAN_AFTER)
    ) {
      const path = planRoute(state, at, goal, {
        avoidMordor,
        keepClear: KEEP_CLEAR
      });
      route = {
        goal: key,
        planned: now,
        // With no way round, straight there.
        points: path
          ? waypoints(path, WAYPOINT_STRIDE)
          : [destinationForClick(goal)]
      };
      routes.set(leader.index, route);
    }
    const point = route.points[0];
    return point ? toward(state, leader.index, point) : null;
  };
};

export const musterPolicy = (
  options: MusterOptions = DEFAULT_MUSTER
): Policy => {
  const toRivendell = placeWalker(TO_RIVENDELL, {
    ...options,
    chargeLastLeg: false
  });
  const next = router();
  let frodoStays = false;
  let theodenRoused = false;
  let striking = false;

  return {
    answer: (state, meeting) => {
      if (state.councilPending) {
        return followWhileQuesting(state, meeting);
      }
      // At the rally, the hosts join into one Force; Frodo's Force
      // keeps to itself.
      const frodoForce = topLeader(state.roster, state.roster[FRODO]!).index;
      return meeting.kind === 'follow' &&
        meeting.a !== frodoForce &&
        meeting.b !== frodoForce
        ? 'follow'
        : 'continue-on';
    },
    decide: state => {
      if (state.councilPending) {
        const command = toRivendell(state, ringLeader(state));
        return command ? [command] : [];
      }
      const commands: Command[] = [];
      // Frodo, with the Ring, leaves Gandalf's Force and stays.
      if (!frodoStays) {
        frodoStays = true;
        if (state.roster[FRODO]!.leader !== null) {
          commands.push({ member: FRODO, to: RIVENDELL });
        }
        return commands;
      }
      const frodoForce = topLeader(state.roster, state.roster[FRODO]!).index;
      const gandalf = topLeader(state.roster, state.roster[GANDALF]!);
      const edoras = place(state, 'EDORAS');
      theodenRoused ||= state.roster[THEODEN]!.allegiance > 1;
      const leaders = state.roster
        .slice(1, LAST_GOOD_ENTRY + 1)
        .filter(
          entry =>
            entry.leader === null &&
            entry.index !== frodoForce &&
            canOrder(state, entry.index)
        );
      const rally = destinationForClick(options.rally);
      if (
        !striking &&
        state.clock.quarterHour > 32 &&
        (state.clock.day >= options.latestStrike ||
          strengthAt(state, rally) >= options.ready)
      ) {
        striking = true;
      }
      for (const leader of leaders) {
        let command: Command | null;
        if (striking) {
          command = next(state, leader, BARAD_DUR, false);
        } else if (
          leader.index === FARAMIR &&
          options.openWar &&
          !hasWarEvent(state.warEvents, 7)
        ) {
          command = toward(state, leader.index, MORDOR_CORNER);
        } else if (leader.index === gandalf.index && !theodenRoused) {
          command = next(state, leader, edoras, true);
        } else {
          command = next(state, leader, rally, true);
        }
        if (command) {
          commands.push(command);
        }
      }
      return commands;
    }
  };
};

export interface DefensiveOptions extends PlanOptions {
  // The Strongholds held, by Place name.
  hold: string[];
  // How far, in pixels, a Force will march to hold one.
  reach: number;
  // Days after the Dark Lord's armies march (War Event 7) before the
  // Ring-bearer's Force leaves its hiding place for Mount Doom.
  setOutAfter: number;
  // Where the Ring-bearer's Force hides while it waits, by Place name.
  wait: string;
}

export const DEFAULT_DEFENSIVE: DefensiveOptions = {
  ...DEFAULT_OPTIONS,
  hold: ['MINAS TIRITH', 'HORNBURG', 'EDORAS'],
  reach: 800,
  setOutAfter: 4,
  wait: 'LORIEN'
};

export const defensivePolicy = (
  options: DefensiveOptions = DEFAULT_DEFENSIVE
): Policy => {
  const walk = { ...options, chargeLastLeg: false };
  const toRivendell = placeWalker(TO_RIVENDELL, walk);
  const toHiding = placeWalker([options.wait], walk);
  const toMountDoom = placeWalker(['NORTH ITHILIEN', 'MT. DOOM'], {
    ...options,
    chargeLastLeg: true
  });
  const next = router();
  return {
    answer: followWhileQuesting,
    decide: state => {
      const ring = ringLeader(state);
      if (state.councilPending) {
        const command = toRivendell(state, ring);
        return command ? [command] : [];
      }
      const commands: Command[] = [];
      const setOut =
        hasWarEvent(state.warEvents, 7) &&
        ((state.clock.day - state.warEvents.days[7]!) & 0xff) >=
          options.setOutAfter;
      const ringCommand = (setOut ? toMountDoom : toHiding)(state, ring);
      if (ringCommand) {
        commands.push(ringCommand);
      }
      const holds = options.hold.map(name => place(state, name));
      const leaders = state.roster
        .slice(1, LAST_GOOD_ENTRY + 1)
        .filter(
          entry =>
            entry.leader === null &&
            entry.index !== ring.index &&
            canOrder(state, entry.index)
        );
      for (const leader of leaders) {
        // Each Force holds the nearest Stronghold within reach.
        const at = leader.position!;
        const hold = holds
          .filter(p => chebyshev(p, at) <= options.reach)
          .sort((a, b) => chebyshev(a, at) - chebyshev(b, at))[0];
        const command = hold ? next(state, leader, hold, true) : null;
        if (command) {
          commands.push(command);
        }
      }
      return commands;
    }
  };
};

export const policyFor = (plan: PlanName): Policy =>
  plan === 'fellowship'
    ? fellowshipPolicy()
    : plan === 'muster'
      ? musterPolicy()
      : defensivePolicy();

// --- Playing and replaying ----------------------------------------------

export interface CampaignResult {
  inputs: DemoInput[];
  milestones: Milestones;
  state: SimState;
}

type Driver =
  { kind: 'policy'; policy: Policy } | { kind: 'script'; script: DemoScript };

const sameClock = (a: Clock, b: Clock): boolean =>
  a.day === b.day && a.quarterHour === b.quarterHour;

const sameMeeting = (a: Meeting, b: Meeting): boolean =>
  a.a === b.a && a.b === b.b && a.kind === b.kind;

// Plays one campaign to an ending or the day cap, driven by a policy
// (recording its inputs) or by a demo script (replaying them).
const runCampaign = (
  seed: number,
  assets: SoakAssets,
  driver: Driver,
  dayCap: number
): CampaignResult => {
  let state = createSim(seed, assets.startingState, assets.tilemap);
  const inputs: DemoInput[] = [];
  const pending =
    driver.kind === 'script' ? [...driver.script.inputs] : ([] as DemoInput[]);
  const milestones: Milestones = {
    council: null,
    mobilisation: null,
    warEvents: []
  };
  const mobilised = new Set(
    state.roster.filter(e => e.allegiance > 1).map(e => e.index)
  );
  let decided: Clock | null = null;
  let steps = 0;
  while (!state.ending && state.clock.day < dayCap) {
    if (++steps > 20_000_000) {
      throw new Error('the campaign stopped moving');
    }
    while (state.announcements.length > 0) {
      state = takeAnnouncement(state).state;
    }
    while (state.passings.length > 0) {
      state = takePassing(state).state;
    }
    if (state.council) {
      state = closeCouncil(state);
    }
    if (state.fight) {
      state = resolveFight(state);
      continue;
    }
    if (state.meeting) {
      const meeting = state.meeting;
      let answer: MeetingAnswer = 'continue-on';
      if (driver.kind === 'policy') {
        answer = driver.policy.answer(state, meeting);
        if (answer !== 'continue-on') {
          inputs.push({
            answer,
            at: { ...state.clock },
            kind: 'answer',
            meeting: { ...meeting }
          });
        }
      } else {
        const input = pending[0];
        if (
          input?.kind === 'answer' &&
          sameClock(input.at, state.clock) &&
          sameMeeting(input.meeting, meeting)
        ) {
          answer = input.answer;
          pending.shift();
        }
      }
      state = answerMeeting(state, answer).world;
      continue;
    }
    if (state.ending) {
      break;
    }
    if (!decided || !sameClock(decided, state.clock)) {
      noteMilestones(state, milestones, mobilised, decided?.day ?? 0);
      decided = { ...state.clock };
      const commands: Command[] = [];
      if (driver.kind === 'policy') {
        commands.push(...driver.policy.decide(state));
      } else {
        while (
          pending[0]?.kind === 'order' &&
          sameClock(pending[0].at, state.clock)
        ) {
          const input = pending.shift() as DemoInput & { kind: 'order' };
          commands.push({ member: input.member, to: input.to });
        }
      }
      for (const command of commands) {
        if (driver.kind === 'policy') {
          inputs.push({ at: { ...state.clock }, kind: 'order', ...command });
        }
        const { taken, world } = takesOrder(state, command.member);
        state = taken ? giveOrder(world, command.member, command.to) : world;
      }
    }
    state = tickSim(state);
  }
  return {
    inputs: driver.kind === 'script' ? driver.script.inputs : inputs,
    milestones,
    state
  };
};

const noteMilestones = (
  state: SimState,
  milestones: Milestones,
  mobilised: Set<number>,
  dayBefore: number
): void => {
  // The Council moves the calendar on (docs/spec/council-of-elrond.md),
  // so it is dated by the last decision point before it.
  if (milestones.council === null && !state.councilPending) {
    milestones.council = dayBefore;
  }
  // Event 1, Gandalf's death, keeps no day (docs/spec/war-events.md).
  for (let event = 3; event < 8; event++) {
    if (
      state.warEvents.mask & (1 << event) &&
      !(INITIAL_WAR_EVENTS.mask & (1 << event)) &&
      !milestones.warEvents.some(noted => noted.event === event)
    ) {
      milestones.warEvents.push({
        day: state.warEvents.days[event]!,
        event
      });
    }
  }
  for (const entry of state.roster.slice(1, LAST_GOOD_ENTRY + 1)) {
    if (entry.allegiance > 1 && !mobilised.has(entry.index)) {
      mobilised.add(entry.index);
      milestones.mobilisation ??= { day: state.clock.day, leader: entry.name };
    }
  }
};

export const playCampaign = (
  seed: number,
  assets: SoakAssets,
  policy: Policy,
  dayCap = 400
): CampaignResult =>
  runCampaign(seed, assets, { kind: 'policy', policy }, dayCap);

export const replayDemo = (
  script: DemoScript,
  assets: SoakAssets,
  dayCap = 400
): CampaignResult =>
  runCampaign(script.seed, assets, { kind: 'script', script }, dayCap);

export const isGoodVictory = (ending: Ending | null): boolean =>
  ending === 'won-mount-doom' || ending === 'won-barad-dur';

export const demoScript = (
  plan: PlanName,
  seed: number,
  result: CampaignResult
): DemoScript => ({
  ending: result.state.ending,
  finalDay: result.state.clock.day,
  inputs: result.inputs,
  milestones: result.milestones,
  plan,
  seed,
  version: DEMO_VERSION
});

export const demoPath = (plan: PlanName): string => `${DEMOS_DIR}${plan}.json`;

export const loadDemo = (plan: PlanName): DemoScript =>
  JSON.parse(readFileSync(demoPath(plan), 'utf8')) as DemoScript;

const describeRun = (seed: number, result: CampaignResult): string => {
  const { council, mobilisation, warEvents } = result.milestones;
  return [
    `seed ${seed}: ${result.state.ending ?? 'no ending'} on day ${result.state.clock.day}`,
    `council ${council ?? '-'}`,
    `War Events ${warEvents.map(e => `${e.event} (day ${e.day})`).join(' ') || '-'}`,
    `mobilisation ${mobilisation ? `${mobilisation.leader} on day ${mobilisation.day}` : '-'}`,
    `Barad-dûr Garrison ${result.state.roster[BARAD_DUR_GARRISON]!.strength}`,
    `${result.inputs.length} inputs`
  ].join(', ');
};

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      from: { default: '1', type: 'string' },
      plan: { default: 'fellowship', type: 'string' },
      seeds: { default: '40', type: 'string' },
      write: { default: false, type: 'boolean' }
    }
  });
  if (!assetsExist()) {
    console.error('web/public/assets/ is missing: run `bun run extract-all`');
    process.exit(2);
  }
  const plan = values.plan as PlanName;
  const assets = loadSoakAssets();
  const from = Number(values.from);
  for (let seed = from; seed < from + Number(values.seeds); seed++) {
    const result = playCampaign(seed, assets, policyFor(plan));
    console.log(describeRun(seed, result));
    if (values.write && isGoodVictory(result.state.ending)) {
      const script = demoScript(plan, seed, result);
      const replayed = replayDemo(script, assets);
      if (replayed.state.ending !== script.ending) {
        console.error(
          `seed ${seed}: the replay ended ${replayed.state.ending}`
        );
        process.exit(1);
      }
      mkdirSync(dirname(demoPath(plan)), { recursive: true });
      writeFileSync(demoPath(plan), `${JSON.stringify(script, null, 2)}\n`);
      console.log(`wrote ${demoPath(plan)}`);
      break;
    }
  }
}
