#!/usr/bin/env bun
// The headless strategy player (#243): plays a whole campaign through
// the same sim API as the soak runner (tools/soak.ts), but with a
// policy in place of its random stand-in, and records what it did as
// a demo script that replays to the same ending.
//
//   bun tools/strategy.ts [--plan fellowship|muster|defensive] [--seeds N]
//                         [--from SEED] [--open-war on|off]
//                         [--tokens on|off] [--avoid on|off] [--write]
//                         [--movement classic|crossing]
//
// --open-war overrides the muster plan's openWar setting, --tokens
// whether the plan carries the sceptre to Denethor (sceptreErrand), and
// --avoid whether the road to Rivendell goes round the Encounter areas
// (encounterAreas), on by default for every plan.
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
//   Edoras, so the Strongholds' Garrisons stand sieges. Faramir stays
//   in North Ithilien and follows the Fellowship there, so his Rangers
//   carry it past the Encounters in Gorgoroth, on a route round the
//   Evil Forces there.
//
// With Tokens on, the default for muster and defensive, Frodo also picks up the sceptre on his way and Merry carries it to
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
  BARAD_DUR_GARRISON,
  DEMO_VERSION,
  FIRST_ENCOUNTER,
  LAST_ENCOUNTER,
  LAST_GOOD_ENTRY,
  QUARTER_HOURS_PER_DAY,
  canOrder,
  destinationForClick,
  firstRiverMet,
  hasWarEvent,
  isGoodVictory,
  replayDemo,
  runToEnd,
  startCampaign,
  stepCampaign,
  terrainAt,
  topLeader,
  type CampaignResult,
  type Command,
  type DemoInput,
  type DemoPlan,
  type DemoScript,
  type Meeting,
  type MeetingAnswer,
  type MovementRule,
  type Player,
  type Point,
  type RosterEntry,
  type SimState
} from '../web/src/sim';
import { assetsExist, loadSoakAssets, type SoakAssets } from './soak';

// The script-driven replay is the Demo driver, shared with the browser.
export {
  DEMO_VERSION,
  isGoodVictory,
  replayDemo,
  type CampaignResult,
  type Command,
  type DemoInput,
  type DemoScript,
  type Milestones,
  type ObjectCommand
} from '../web/src/sim';

export const DEMOS_DIR = new URL('../web/public/demos/', import.meta.url)
  .pathname;

export type PlanName = DemoPlan;

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

// Setup facts are supplied separately from observations of the moving
// Forces and the player's own inventory. Memorised knowledge keeps the
// Classic Setup; live knowledge reads the campaign being played.
export interface SetupKnowledge {
  encounterAreas: (state: SimState) => Area[];
  objectPosition: (state: SimState, object: number) => Point | null;
  place: (state: SimState, name: string) => Point;
}

const knowledgeFrom = (
  source: (state: SimState) => SimState
): SetupKnowledge => ({
  encounterAreas: state => encounterAreas(source(state)),
  objectPosition: (state, object) =>
    source(state).objectPlacements.find(slot => slot?.object === object)
      ?.position ?? null,
  place: (state, name) => place(source(state), name)
});

export const LIVE_KNOWLEDGE = knowledgeFrom(state => state);

export const memorisedKnowledge = (classic: SimState): SetupKnowledge =>
  knowledgeFrom(() => classic);

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
  const width = state.terrain?.width ?? 0;
  const height = state.terrain?.height ?? 0;
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
  avoidEncounters: true,
  fleeRadius: 96,
  tokens: false
};

// The Ring-bearer's Force's Leader.
const ringLeader = (state: SimState): RosterEntry =>
  topLeader(state.roster, state.roster[state.ringBearer ?? FRODO]!);

// A command toward `to`, unless the Leader already stands there or is
// already bound there. With `wake` set, a Leader resting with full
// stamina is given its Order again, which sets it moving at once, as a
// player clicking it again does; left alone it sets off only by a
// 1-in-10 chance a step in the morning (finding:movement-stamina-and-rest).
const toward = (
  state: SimState,
  member: number,
  to: Point,
  wake = false
): Command | null => {
  const entry = state.roster[member]!;
  const destination = destinationForClick(to);
  const rested = wake && entry.state === 3 && entry.stamina >= entry.maxStamina;
  if (
    !canOrder(state, member) ||
    same(entry.position, destination) ||
    (same(entry.destination, destination) && !rested)
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
const detourRound = (
  state: SimState,
  from: Point,
  goal: Point,
  knowledge: SetupKnowledge
): Point[] => {
  const areas = knowledge.encounterAreas(state);
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
  names: (Point | string | { object: number })[],
  options: PlanOptions & { chargeLastLeg: boolean },
  knowledge: SetupKnowledge
) => {
  let leg = 0;
  let detourLeg = -1;
  let detour: Point[] = [];
  const point = (
    state: SimState,
    stop: (typeof names)[number]
  ): Point | null =>
    typeof stop === 'string'
      ? knowledge.place(state, stop)
      : 'object' in stop
        ? knowledge.objectPosition(state, stop.object)
        : stop;
  return (state: SimState, leader: RosterEntry): Command | null => {
    const at = leader.position!;
    let goal = point(state, names[leg]!);
    while (leg < names.length - 1 && (goal === null || same(at, goal))) {
      goal = point(state, names[++leg]!);
    }
    if (goal === null || same(at, goal)) {
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
    const repel: Point[] = threats.map(entry => entry.position!);
    if (!charging) {
      for (const entry of visibleEvil(state)) {
        if (
          entry.state === 1 &&
          entry.destination &&
          chebyshev(entry.position!, at) <= options.fleeRadius * 2 &&
          chebyshev(entry.destination, at) <= options.fleeRadius
        ) {
          repel.push(entry.destination);
        }
      }
    }
    if (options.avoidEncounters && detourLeg !== leg) {
      detourLeg = leg;
      detour = detourRound(state, at, goal, knowledge);
    }
    while (detour.length > 0 && same(at, detour[0]!)) {
      detour.shift();
    }
    if (repel.length === 0) {
      return toward(state, leader.index, detour[0] ?? goal);
    }
    // Away from the threats, nearer ones counting for more, and from
    // where a moving Evil Force close by is bound when that is near:
    // the Nazgûl's Default Orders stops north of the Shire are where
    // fleeing them along the East Road would otherwise lead (seeds 20
    // and 29). A Leader that ran out of stamina while fleeing is woken.
    let vx = 0;
    let vy = 0;
    for (const threat of repel) {
      const dx = at.x - threat.x;
      const dy = at.y - threat.y;
      const d2 = dx * dx + dy * dy || 1;
      vx += dx / d2;
      vy += dy / d2;
    }
    const n = Math.hypot(vx, vy) || 1;
    return toward(
      state,
      leader.index,
      fleeTarget(state, at, Math.atan2(vy / n, vx / n)),
      true
    );
  };
};

// Turns tried, in order, when fleeing straight away would cross a river.
const FLEE_TURNS = [0, 1, -1, 2, -2, 3, -3].map(step => (step * Math.PI) / 6);

// Where a Leader at `at` flees to, 48 pixels away at `angle`. Under
// Crossing movement a flight across a river heads first for its
// Crossing (docs/spec/crossing-movement.md), and near the Brandywine
// Bridge that held the Ring-bearer among the Nazgûl, ordered there
// again and again (#346). So the flight turns, by up to a quarter
// circle each way, to keep to the bank it is on. A player reads the
// rivers from the map.
const fleeTarget = (state: SimState, at: Point, angle: number): Point => {
  const target = (turn: number): Point => ({
    x: Math.round(at.x + Math.cos(angle + turn) * 48),
    y: Math.round(at.y + Math.sin(angle + turn) * 48)
  });
  const { waterways } = state;
  if (state.movementRule !== 'crossing' || !waterways) {
    return target(0);
  }
  const dry = FLEE_TURNS.map(target).find(
    to => firstRiverMet(waterways, at, destinationForClick(to)) === null
  );
  return dry ?? target(0);
};

// Before the Council: Frodo by Buckland and Bree, where Merry and
// Aragorn join him, to Rivendell, where Gandalf waits.
const TO_RIVENDELL = ['BUCKLAND', 'BREE', 'RIVENDELL'];

// The sceptre starts on the ground by Annuminas, a short way north of
// Frodo (finding:objects-starting-placements), so with Tokens Frodo's
// road to Rivendell starts there.
const roadToRivendell = (tokens: boolean): (string | { object: number })[] =>
  tokens ? [{ object: SCEPTRE }, ...TO_RIVENDELL] : TO_RIVENDELL;

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
const sceptreErrand = (courier: number, knowledge: SetupKnowledge) => {
  const route = router();
  let done = false;
  let attempted = false;
  const step = (state: SimState): Command[] => {
    const denethor = state.roster[DENETHOR]!;
    const carrier = state.roster[courier]!;
    const frodo = state.roster[FRODO]!;
    const sceptreAt = knowledge.objectPosition(state, SCEPTRE);
    const carried = carrier.objects.includes(SCEPTRE);
    const frodoCarries = frodo.objects.includes(SCEPTRE);
    const lying = !attempted && !carried && !frodoCarries && sceptreAt !== null;
    done ||=
      carrier.strength === 0 ||
      denethor.state === 0 ||
      denethor.allegiance !== 1 ||
      denethor.position === null ||
      !(lying || carried || frodoCarries);
    if (done) {
      return [];
    }
    const ringAt = topLeader(state.roster, frodo).position;
    if (lying) {
      if (same(ringAt, sceptreAt)) {
        attempted = true;
        return [{ act: 'take', member: FRODO, object: SCEPTRE }];
      }
      return [];
    }
    const at = topLeader(state.roster, carrier).position;
    const goal = denethor.position!;
    const rivendell = knowledge.place(state, 'RIVENDELL');
    if (!carried) {
      // Frodo carries it: handed over where they stand together, at
      // Rivendell before the Council.
      const handOver =
        carrier.state !== 0 &&
        same(ringAt, at) &&
        (!state.councilPending || same(ringAt, rivendell));
      if (!handOver) {
        return [];
      }
      const commands: Command[] = [
        { act: 'put-down', member: FRODO, object: SCEPTRE },
        { act: 'take', member: courier, object: SCEPTRE }
      ];
      if (state.councilPending && frodo.leader !== null) {
        commands.push({ member: FRODO, to: rivendell });
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

// After the Council, Faramir's offer to follow the Ring-bearer's Force
// is taken: a Force with a Unit is passed by the small Encounters, and
// the large ones meet only Forces led by entries above 12
// (finding:combat-evil-encounters-attack), so the balrog in Gorgoroth
// no longer wipes out the Fellowship.
const faramirEscorts = (state: SimState, meeting: Meeting): MeetingAnswer => {
  const ring = ringLeader(state).index;
  return meeting.kind === 'follow' &&
    !state.councilPending &&
    ((meeting.a === FARAMIR && meeting.b === ring) ||
      (meeting.b === FARAMIR && meeting.a === ring))
    ? 'follow'
    : followWhileQuesting(state, meeting);
};

export const fellowshipPolicy = (
  options: PlanOptions = DEFAULT_OPTIONS,
  knowledge: SetupKnowledge = LIVE_KNOWLEDGE
): Policy => {
  const toRivendell = placeWalker(
    roadToRivendell(options.tokens),
    {
      ...options,
      chargeLastLeg: false
    },
    knowledge
  );
  const toMountDoom = placeWalker(
    ['LORIEN', 'NORTH ITHILIEN', 'MT. DOOM'],
    {
      ...options,
      avoidEncounters: false,
      chargeLastLeg: true
    },
    knowledge
  );
  const errand = sceptreErrand(MERRY, knowledge);
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

// Clearance, in pixels, that the escorted Ring-bearer's Force keeps from
// visible Evil Forces in Gorgoroth: the Wainriders wander some 16 pixels
// about where they stand, so the marching routes' 32 is too close.
const ESCORT_CLEAR = 48;

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
    charge = false,
    keepClear = KEEP_CLEAR
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
        keepClear
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
  options: MusterOptions = DEFAULT_MUSTER,
  knowledge: SetupKnowledge = LIVE_KNOWLEDGE
): Policy => {
  const toRivendell = placeWalker(
    roadToRivendell(options.tokens),
    {
      ...options,
      chargeLastLeg: false
    },
    knowledge
  );
  const next = router();
  const errand = sceptreErrand(MERRY, knowledge);
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
          commands.push({
            member: FRODO,
            to: knowledge.place(state, 'RIVENDELL')
          });
        }
        return commands;
      }
      const frodoForce = topLeader(state.roster, state.roster[FRODO]!).index;
      const gandalf = topLeader(state.roster, state.roster[GANDALF]!);
      const edoras = knowledge.place(state, 'EDORAS');
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
          command = next(
            state,
            leader,
            knowledge.place(state, 'BARAD-DUR'),
            false,
            true
          );
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
  options: DefensiveOptions = DEFAULT_DEFENSIVE,
  knowledge: SetupKnowledge = LIVE_KNOWLEDGE
): Policy => {
  const walk = { ...options, chargeLastLeg: false };
  const toRivendell = placeWalker(
    roadToRivendell(options.tokens),
    walk,
    knowledge
  );
  const toHiding = placeWalker(
    [options.wait],
    {
      ...walk,
      avoidEncounters: false
    },
    knowledge
  );
  const toMountDoom = placeWalker(
    ['NORTH ITHILIEN', 'MT. DOOM'],
    {
      ...options,
      avoidEncounters: false,
      chargeLastLeg: true
    },
    knowledge
  );
  const next = router();
  const ringRoute = router();
  let escorted = false;
  const errand = sceptreErrand(MERRY, knowledge);
  return {
    answer: options.tokens ? errand.answer(faramirEscorts) : faramirEscorts,
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
      // Once Faramir's Force joins it, the Ring-bearer's Force no
      // longer charges straight on, but goes round the visible Evil
      // Forces in Gorgoroth, and waits where it stands while none is
      // clear. The Wainriders (entry 101) otherwise stand on the straight
      // way from North Ithilien to Mount Doom and beat the escorted
      // Force, which a Unit stops from evading.
      escorted ||=
        setOut &&
        topLeader(state.roster, state.roster[FARAMIR]!).index === ring.index;
      const ringCommand = escorted
        ? ringRoute(
            state,
            ring,
            knowledge.place(state, 'MT. DOOM'),
            false,
            false,
            ESCORT_CLEAR
          )
        : (setOut ? toMountDoom : toHiding)(state, ring);
      if (ringCommand) {
        commands.push(ringCommand);
      }
      const holds = options.hold.map(name => knowledge.place(state, name));
      const leaders = state.roster.slice(1, LAST_GOOD_ENTRY + 1).filter(
        entry =>
          entry.leader === null &&
          entry.index !== ring.index &&
          // Faramir waits at North Ithilien, the last waypoint, to
          // join the Ring-bearer's Force as it passes.
          entry.index !== FARAMIR &&
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
// plan's settings. Over Classic seeds 1 to 10,000 (#282) the sceptre
// errand raised muster's win rate from 46.9% to 49.1% and defensive's
// from 91.0% to 91.9%, and cost fellowship's (17.3% to 16.9%). So it
// is on for muster and defensive.
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
  } = {},
  knowledge: SetupKnowledge = LIVE_KNOWLEDGE
): Policy => {
  if (plan === 'fellowship') {
    return fellowshipPolicy(
      {
        ...DEFAULT_OPTIONS,
        avoidEncounters:
          overrides.avoidEncounters ?? DEFAULT_OPTIONS.avoidEncounters,
        tokens: overrides.tokens ?? false
      },
      knowledge
    );
  }
  if (plan === 'muster') {
    const openWar = overrides.openWar ?? DEFAULT_MUSTER.openWar;
    return musterPolicy(
      {
        ...DEFAULT_MUSTER,
        avoidEncounters:
          overrides.avoidEncounters ?? DEFAULT_MUSTER.avoidEncounters,
        openWar,
        tokens: overrides.tokens ?? true
      },
      knowledge
    );
  }
  return defensivePolicy(
    {
      ...DEFAULT_DEFENSIVE,
      avoidEncounters:
        overrides.avoidEncounters ?? DEFAULT_DEFENSIVE.avoidEncounters,
      tokens: overrides.tokens ?? true
    },
    knowledge
  );
};

// --- Playing and replaying ----------------------------------------------

// Records the Policy's inputs as it plays them.
const recording = (policy: Policy, inputs: DemoInput[]): Player => ({
  answer: (state, meeting) => {
    const answer = policy.answer(state, meeting);
    if (answer !== 'continue-on') {
      inputs.push({
        answer,
        at: { ...state.clock },
        kind: 'answer',
        meeting: { ...meeting }
      });
    }
    return answer;
  },
  decide: state =>
    policy.decide(state).map(command => {
      inputs.push(
        'act' in command
          ? { at: { ...state.clock }, kind: 'object', ...command }
          : { at: { ...state.clock }, kind: 'order', ...command }
      );
      return command;
    })
});

// Plays one campaign to an ending or the day cap, driven by a policy,
// and records its inputs as a demo script's.
export const playCampaign = (
  seed: number,
  assets: SoakAssets,
  policy: Policy,
  dayCap = 400,
  movementRule: MovementRule = 'classic'
): CampaignResult => {
  const inputs: DemoInput[] = [];
  const player = recording(policy, inputs);
  const { milestones, state } = runToEnd(
    startCampaign(seed, assets, {
      movementRule,
      waterways: assets.waterways
    }),
    run => stepCampaign(run, player),
    dayCap
  );
  return { inputs, milestones, state };
};

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
      movement: { default: 'classic', type: 'string' },
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
  const { movement } = values;
  if (movement !== 'classic' && movement !== 'crossing') {
    console.error('--movement must be classic or crossing');
    process.exit(2);
  }
  if (values.write && movement !== 'classic') {
    console.error('--write records Classic movement only');
    process.exit(2);
  }
  const assets = loadSoakAssets();
  const from = Number(values.from);
  for (let seed = from; seed < from + Number(values.seeds); seed++) {
    const result = playCampaign(
      seed,
      assets,
      policyFor(plan, { avoidEncounters, openWar, tokens }),
      400,
      movement
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
