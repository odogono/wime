#!/usr/bin/env bun
// The headless strategy player (#243): plays a whole campaign through
// the same sim API as the soak runner (tools/soak.ts), but with a
// policy in place of its random stand-in, and records what it did as
// a demo script that replays to the same ending.
//
//   bun tools/strategy.ts [--plan fellowship|muster|defensive] [--seeds N]
//                         [--from SEED] [--open-war on|off]
//                         [--tokens on|off] [--avoid on|off] [--write]
//
// --open-war overrides the muster plan's openWar setting, --tokens
// whether the plan carries the sceptre to Denethor (sceptreErrand), and
// --avoid whether the road to Rivendell goes round the Encounter areas
// (encounterAreas).
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
// With Tokens on, the default only for muster without the open war,
// Frodo also picks up the sceptre on his way and Merry carries it to
// Denethor, which wakes Gondor before the war (sceptreErrand).
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
  FIRST_ENCOUNTER,
  INITIAL_WAR_EVENTS,
  LAST_ENCOUNTER,
  LAST_GOOD_ENTRY,
  QUARTER_HOURS_PER_DAY,
  RIVENDELL,
  answerMeeting,
  applyObject,
  canOrder,
  closeCouncil,
  createSim,
  destinationForClick,
  giveOrder,
  hasWarEvent,
  putDownObject,
  resolveFight,
  takeAnnouncement,
  takeObject,
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
  | ({ at: Clock; kind: 'object' } & ObjectCommand)
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
const MERRY = 9;
const DENETHOR = 32;
const SCEPTRE = 14;
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

export interface Area {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

// The Evil Encounter figures that a Force led by the Fellowship can
// meet wait each in an area, and one met there attacks
// (finding:forces-encounter-figures-wait-in-areas,
// finding:combat-evil-encounters-attack). The areas are hidden from
// a player, so this is knowledge the policy has and a player would not:
// a player learns them only by losing Characters in them. Areas wider
// or taller than this are not worth going round, as the wolves' between
// Bree and Rivendell.
const AVOIDABLE_SPAN = 256;
const FELLOWSHIP_FIGURE = 99;

export const encounterAreas = (state: SimState): Area[] =>
  state.roster
    .slice(FIRST_ENCOUNTER, LAST_ENCOUNTER + 1)
    .filter(
      entry =>
        entry.allegiance === 0 &&
        entry.strength <= FELLOWSHIP_FIGURE &&
        entry.encounter !== null &&
        entry.encounter.area.right - entry.encounter.area.left <=
          AVOIDABLE_SPAN &&
        entry.encounter.area.bottom - entry.encounter.area.top <= AVOIDABLE_SPAN
    )
    .map(entry => entry.encounter!.area);

const inAnyArea = (p: Point, areas: Area[]): boolean =>
  areas.some(
    area =>
      p.x >= area.left &&
      p.x <= area.right &&
      p.y >= area.top &&
      p.y <= area.bottom
  );

// A step onto a tile in an avoided area costs this many times its pace,
// so a route goes round one when a detour exists, and through it when
// none does.
const AVOID_COST = 20;

interface RouteOptions {
  // Areas to go round when a detour exists.
  avoid?: Area[];
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
  const avoid = options.avoid ?? [];
  const avoided = (x: number, y: number): boolean =>
    inAnyArea({ x: x * TILE, y: y * TILE }, avoid);
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
        const step =
          (((dx && dy ? Math.SQRT2 : 1) * 100) / terrain) *
          (avoided(nx, ny) ? AVOID_COST : 1);
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

// An Order, or an action in the provisions sack: Take, Put Down or
// Use, by the chosen Character at its Force's position, as the
// provisions lists do (finding:objects-provisions-lists).
export interface ObjectCommand {
  act: 'put-down' | 'take' | 'use';
  member: number;
  object: number;
}

export type Command = ObjectCommand | { member: number; to: Point };

export interface Policy {
  answer: (state: SimState, meeting: Meeting) => MeetingAnswer;
  // Called once per quarter-hour, when nothing waits on the player.
  decide: (state: SimState) => Command[];
}

export interface PlanOptions {
  // Route the road to Rivendell round the Encounter areas
  // (encounterAreas).
  avoidEncounters: boolean;
  // How near, in pixels, a moving Evil Force may come to the
  // Ring-bearer's Force before it turns away.
  fleeRadius: number;
  // Carry the sceptre to Denethor before the war (sceptreErrand).
  tokens: boolean;
}

export const DEFAULT_OPTIONS: PlanOptions = {
  avoidEncounters: false,
  fleeRadius: 96,
  tokens: false
};

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

// The tiles, short of the goal, of a route from `from` to `goal` round
// the Encounter areas, or none when no area lies near the way. A Force
// sent straight to its goal steers its own way, which may cut into an
// area that a planned route skirts, so a leg near one is walked tile by
// tile; as from Buckland to Bree, whose road runs along the wight's
// area.
const detourRound = (state: SimState, from: Point, goal: Point): Point[] => {
  const areas = encounterAreas(state);
  const near: Area = {
    bottom: Math.max(from.y, goal.y) + TILE,
    left: Math.min(from.x, goal.x) - TILE,
    right: Math.max(from.x, goal.x) + TILE,
    top: Math.min(from.y, goal.y) - TILE
  };
  if (
    !areas.some(
      area =>
        area.left <= near.right &&
        area.right >= near.left &&
        area.top <= near.bottom &&
        area.bottom >= near.top
    )
  ) {
    return [];
  }
  const path = planRoute(state, from, goal, {
    avoid: areas,
    avoidMordor: false,
    keepClear: 0
  });
  return path ? path.slice(1, -1) : [];
};

// Walks a Leader through named Places one after the other, turning away
// from moving Evil Forces (the Nazgûl, Encounters on the road) and
// from any Evil Force close by. With `charge` set, the last leg goes
// straight on whatever is in the way. With `avoidEncounters` set, a leg
// whose route crosses an Encounter area (encounterAreas) goes by the
// waypoints of a route round it, when one exists.
const placeWalker = (
  names: (Point | string)[],
  options: PlanOptions & { chargeLastLeg: boolean }
) => {
  let leg = 0;
  let detourLeg = -1;
  let detour: Point[] = [];
  const point = (state: SimState, stop: Point | string): Point =>
    typeof stop === 'string' ? place(state, stop) : stop;
  return (state: SimState, leader: RosterEntry): Command | null => {
    const at = leader.position!;
    while (leg < names.length - 1 && same(at, point(state, names[leg]!))) {
      leg++;
    }
    const goal = point(state, names[leg]!);
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
    if (options.avoidEncounters && detourLeg !== leg) {
      detourLeg = leg;
      detour = detourRound(state, at, goal);
    }
    while (detour.length > 0 && same(at, detour[0]!)) {
      detour.shift();
    }
    if (threats.length === 0) {
      return toward(state, leader.index, detour[0] ?? goal);
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

// The sceptre starts on the ground by Annuminas, a short way north of
// Frodo (finding:objects-starting-placements), so with Tokens Frodo's
// road to Rivendell starts there.
const SCEPTRE_AT: Point = { x: 624, y: 272 };

const roadToRivendell = (tokens: boolean): (Point | string)[] =>
  tokens ? [SCEPTRE_AT, ...TO_RIVENDELL] : TO_RIVENDELL;

// Before the war, the sceptre shown to Denethor mobilises him, and so
// sets War Event 3, which brings Gondor's lords to Minas Tirith
// (finding:mobilisation-token-shown-to-ruler,
// finding:mobilisation-elves-and-dwarves-wait-for-war-event-7).
//
// Frodo takes it from the ground on his way. The courier, Merry, who
// joins him on the road, goes with him to Rivendell. The Council is held only on
// the hour (docs/spec/council-of-elrond.md), so a Force that arrives
// between hours waits there a quarter-hour or more: Frodo hands the
// courier the sceptre and both leave the Force, Frodo staying and the
// courier making for Minas Tirith. The Council then puts every Leader
// with a destination at it, so the courier arrives at once and shows
// the sceptre to Denethor. A Force that arrives on the hour meets the
// Council straight away; then Frodo hands the sceptre over after it,
// and the courier walks.
//
// `step` gives the commands for this quarter-hour, after the plan's own
// for the Ring-bearer's Force; `busy` says whether the courier is still
// on the errand, when the plan leaves him alone.
const sceptreErrand = (courier: number) => {
  const route = router();
  let done = false;
  const step = (state: SimState): Command[] => {
    const denethor = state.roster[DENETHOR]!;
    const carrier = state.roster[courier]!;
    const frodo = state.roster[FRODO]!;
    const lying = state.objectPlacements.some(
      slot => slot?.object === SCEPTRE && same(slot.position, SCEPTRE_AT)
    );
    const carried = carrier.objects.includes(SCEPTRE);
    done ||=
      carrier.strength === 0 ||
      denethor.state === 0 ||
      denethor.allegiance !== 1 ||
      denethor.position === null ||
      !(lying || carried || frodo.objects.includes(SCEPTRE));
    if (done) {
      return [];
    }
    const ringAt = topLeader(state.roster, frodo).position;
    if (lying) {
      return same(ringAt, SCEPTRE_AT)
        ? [{ act: 'take', member: FRODO, object: SCEPTRE }]
        : [];
    }
    const at = topLeader(state.roster, carrier).position;
    const goal = denethor.position!;
    if (!carried) {
      // Frodo carries it: handed over where they stand together, at
      // Rivendell before the Council.
      const handOver =
        carrier.state !== 0 &&
        same(ringAt, at) &&
        (!state.councilPending || same(ringAt, RIVENDELL));
      if (!handOver) {
        return [];
      }
      const commands: Command[] = [
        { act: 'put-down', member: FRODO, object: SCEPTRE },
        { act: 'take', member: courier, object: SCEPTRE }
      ];
      if (state.councilPending && frodo.leader !== null) {
        commands.push({ member: FRODO, to: RIVENDELL });
      }
      const order = toward(state, courier, goal);
      return order ? [...commands, order] : commands;
    }
    if (same(at, goal)) {
      return [{ act: 'use', member: courier, object: SCEPTRE }];
    }
    const order =
      carrier.leader === null && !state.councilPending
        ? route(state, carrier, goal, true)
        : toward(state, courier, goal);
    return order ? [order] : [];
  };
  // Meetings with the courier on his way are passed by.
  const answer =
    (base: Policy['answer']): Policy['answer'] =>
    (state, meeting) =>
      !done &&
      state.roster[courier]!.objects.includes(SCEPTRE) &&
      (meeting.a === courier || meeting.b === courier)
        ? 'continue-on'
        : base(state, meeting);
  return {
    answer,
    busy: (index: number) => !done && index === courier,
    step
  };
};

const followWhileQuesting = (
  state: SimState,
  meeting: Meeting
): MeetingAnswer =>
  meeting.kind === 'follow' && state.councilPending ? 'follow' : 'continue-on';

export const fellowshipPolicy = (
  options: PlanOptions = DEFAULT_OPTIONS
): Policy => {
  const toRivendell = placeWalker(roadToRivendell(options.tokens), {
    ...options,
    chargeLastLeg: false
  });
  const toMountDoom = placeWalker(['LORIEN', 'NORTH ITHILIEN', 'MT. DOOM'], {
    ...options,
    avoidEncounters: false,
    chargeLastLeg: true
  });
  const errand = sceptreErrand(MERRY);
  return {
    answer: options.tokens
      ? errand.answer(followWhileQuesting)
      : followWhileQuesting,
    decide: state => {
      const leader = ringLeader(state);
      const walk = state.councilPending ? toRivendell : toMountDoom;
      const command = walk(state, leader);
      return [
        ...(command ? [command] : []),
        ...(options.tokens ? errand.step(state) : [])
      ];
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
  avoidEncounters: true,
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
// it strays off. With no way round, as when Evil Forces surround it,
// the Leader halts where it stands and plans again later, rather than
// marching straight through them; unless `charge` is set, as for the
// strike on Barad-dûr, when it goes straight there.
const router = () => {
  const routes = new Map<
    number,
    { goal: string; planned: number; points: Point[] }
  >();
  return (
    state: SimState,
    leader: RosterEntry,
    goal: Point,
    avoidMordor: boolean,
    charge = false
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
        points: path
          ? waypoints(path, WAYPOINT_STRIDE)
          : charge
            ? [destinationForClick(goal)]
            : []
      };
      routes.set(leader.index, route);
    }
    const point = route.points[0];
    if (point) {
      return toward(state, leader.index, point);
    }
    const here = destinationForClick(at);
    return leader.destination !== null &&
      !same(leader.destination, here) &&
      canOrder(state, leader.index)
      ? { member: leader.index, to: here }
      : null;
  };
};

const musterAnswer: Policy['answer'] = (state, meeting) => {
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
};

export const musterPolicy = (
  options: MusterOptions = DEFAULT_MUSTER
): Policy => {
  const toRivendell = placeWalker(roadToRivendell(options.tokens), {
    ...options,
    chargeLastLeg: false
  });
  const next = router();
  const errand = sceptreErrand(MERRY);
  let frodoStays = false;
  let theodenRoused = false;
  let striking = false;

  return {
    answer: options.tokens ? errand.answer(musterAnswer) : musterAnswer,
    decide: state => {
      if (state.councilPending) {
        const leader = ringLeader(state);
        const command = toRivendell(state, leader);
        return [
          ...(command ? [command] : []),
          ...(options.tokens ? errand.step(state) : [])
        ];
      }
      const commands: Command[] = options.tokens ? errand.step(state) : [];
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
            !(options.tokens && errand.busy(entry.index)) &&
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
          command = next(state, leader, BARAD_DUR, false, true);
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
  const toRivendell = placeWalker(roadToRivendell(options.tokens), walk);
  const toHiding = placeWalker([options.wait], {
    ...walk,
    avoidEncounters: false
  });
  const toMountDoom = placeWalker(['NORTH ITHILIEN', 'MT. DOOM'], {
    ...options,
    avoidEncounters: false,
    chargeLastLeg: true
  });
  const next = router();
  const errand = sceptreErrand(MERRY);
  return {
    answer: options.tokens
      ? errand.answer(followWhileQuesting)
      : followWhileQuesting,
    decide: state => {
      const ring = ringLeader(state);
      if (state.councilPending) {
        const command = toRivendell(state, ring);
        return [
          ...(command ? [command] : []),
          ...(options.tokens ? errand.step(state) : [])
        ];
      }
      const commands: Command[] = options.tokens ? errand.step(state) : [];
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
            !(options.tokens && errand.busy(entry.index)) &&
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

// The plan's policy; `openWar` and `tokens`, when given, override the
// plan's settings. Over seeds 1 to 40 the sceptre errand helped only the
// muster plan without the open war, where Gondor otherwise waits for
// day 149 (4 wins in place of 1); with the open war, event 7 wakes
// Gondor within days of the Council anyway and the errand cost wins
// (13 in place of 19), and it changed nothing for the fellowship (7)
// and defensive (17) plans. So it is on only there.
//
// Going round the Encounter areas on the road to Rivendell brought 38
// of seeds 1 to 40 to the Council in place of 30 under every plan, but
// what follows plays out differently, and wins moved from 19 to 20 for
// muster, 7 to 6 for fellowship and 16 to 13 for defensive. So it too
// is on only for muster.
export const policyFor = (
  plan: PlanName,
  overrides: {
    avoidEncounters?: boolean | undefined;
    openWar?: boolean | undefined;
    tokens?: boolean | undefined;
  } = {}
): Policy => {
  if (plan === 'fellowship') {
    return fellowshipPolicy({
      ...DEFAULT_OPTIONS,
      avoidEncounters:
        overrides.avoidEncounters ?? DEFAULT_OPTIONS.avoidEncounters,
      tokens: overrides.tokens ?? false
    });
  }
  if (plan === 'muster') {
    const openWar = overrides.openWar ?? DEFAULT_MUSTER.openWar;
    return musterPolicy({
      ...DEFAULT_MUSTER,
      avoidEncounters:
        overrides.avoidEncounters ?? DEFAULT_MUSTER.avoidEncounters,
      openWar,
      tokens: overrides.tokens ?? !openWar
    });
  }
  return defensivePolicy({
    ...DEFAULT_DEFENSIVE,
    avoidEncounters:
      overrides.avoidEncounters ?? DEFAULT_DEFENSIVE.avoidEncounters,
    tokens: overrides.tokens ?? false
  });
};

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
          (pending[0]?.kind === 'order' || pending[0]?.kind === 'object') &&
          sameClock(pending[0].at, state.clock)
        ) {
          const { at: _at, kind: _kind, ...command } = pending.shift()!;
          commands.push(command as Command);
        }
      }
      for (const command of commands) {
        if ('act' in command) {
          if (driver.kind === 'policy') {
            inputs.push({ at: { ...state.clock }, kind: 'object', ...command });
          }
          state = actOnObject(state, command);
          continue;
        }
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

// Take, Put Down or Use, at the position of the chosen Character's
// Force (finding:objects-provisions-lists).
const actOnObject = (state: SimState, command: ObjectCommand): SimState => {
  const position = topLeader(
    state.roster,
    state.roster[command.member]!
  ).position!;
  const { act, member, object } = command;
  return act === 'take'
    ? takeObject(state, member, object, position)
    : act === 'put-down'
      ? putDownObject(state, member, object, position)
      : applyObject(state, member, object, position).state;
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
      avoid: { type: 'string' },
      from: { default: '1', type: 'string' },
      'open-war': { type: 'string' },
      plan: { default: 'fellowship', type: 'string' },
      seeds: { default: '40', type: 'string' },
      tokens: { type: 'string' },
      write: { default: false, type: 'boolean' }
    }
  });
  if (!assetsExist()) {
    console.error('web/public/assets/ is missing: run `bun run extract-all`');
    process.exit(2);
  }
  const plan = values.plan as PlanName;
  const openWarFlag = values['open-war'];
  if (
    openWarFlag !== undefined &&
    openWarFlag !== 'on' &&
    openWarFlag !== 'off'
  ) {
    console.error('--open-war takes on or off');
    process.exit(2);
  }
  const openWar = openWarFlag === undefined ? undefined : openWarFlag === 'on';
  const tokensFlag = values.tokens;
  if (tokensFlag !== undefined && tokensFlag !== 'on' && tokensFlag !== 'off') {
    console.error('--tokens takes on or off');
    process.exit(2);
  }
  const tokens = tokensFlag === undefined ? undefined : tokensFlag === 'on';
  const avoidFlag = values.avoid;
  if (avoidFlag !== undefined && avoidFlag !== 'on' && avoidFlag !== 'off') {
    console.error('--avoid takes on or off');
    process.exit(2);
  }
  const avoidEncounters =
    avoidFlag === undefined ? undefined : avoidFlag === 'on';
  const assets = loadSoakAssets();
  const from = Number(values.from);
  for (let seed = from; seed < from + Number(values.seeds); seed++) {
    const result = playCampaign(
      seed,
      assets,
      policyFor(plan, { avoidEncounters, openWar, tokens })
    );
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
