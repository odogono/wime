import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import type { Clock } from './clock';
import {
  fightRound,
  resolveFight,
  type CombatEvent,
  type CombatRow,
  type Fight
} from './combat';
import { RIVENDELL, closeCouncil, type CouncilMessage } from './council';
import type { CrossingLeg } from './crossing-movement';
import { isEncounter, type Passing } from './encounters';
import { answerMeeting, type Meeting } from './meetings';
import { giveOrder } from './movement';
import { SAVE_VERSION, restoreSave, serialiseSave } from './save';
import type {
  ObjectPlacement,
  Place,
  PlaceKind,
  Point,
  RosterEntry
} from './starting-state';
import { createSim, tickSim, type SimState } from './state';
import {
  loadTerrainRegions,
  terrainGridFrom,
  terrainGridOf,
  type TerrainGrid
} from './terrain';
import type { WarEventAnnouncement, WarEvents } from './war-events';
import { loadWaterways } from './waterways';

// Every field of the saved state, nested types included. Adding a field
// to any of these types breaks the typecheck here until it is listed,
// and listing it changes the shape below.
type Fields<T> = { [K in keyof Required<T>]: true };
const SHAPE = {
  announcement: {
    day: true,
    event: true
  } satisfies Fields<WarEventAnnouncement>,
  clock: { day: true, quarterHour: true } satisfies Fields<Clock>,
  combatEvent: {
    blow: true,
    killed: true,
    row: true,
    wounded: true
  } satisfies Fields<CombatEvent>,
  combatRow: {
    entries: true,
    follower: true,
    option: true,
    side: true,
    startStrength: true,
    strength: true
  } satisfies Fields<CombatRow>,
  council: { ringBearer: true } satisfies Fields<CouncilMessage>,
  crossingLeg: {
    destination: true,
    rivers: true,
    riversCrossed: true,
    waypoint: true
  } satisfies Fields<CrossingLeg>,
  fight: {
    events: true,
    evil: true,
    good: true,
    position: true,
    round: true,
    rows: true,
    winner: true
  } satisfies Fields<Fight>,
  meeting: { a: true, b: true, kind: true } satisfies Fields<Meeting>,
  objectPlacement: {
    object: true,
    position: true
  } satisfies Fields<ObjectPlacement>,
  passing: { a: true, b: true } satisfies Fields<Passing>,
  place: {
    announcesAttacks: true,
    gridByte: true,
    gridReference: true,
    index: true,
    name: true,
    position: true,
    tile: true,
    tileKind: true
  } satisfies Fields<Place>,
  placeKind: {
    index: true,
    name: true,
    tile: true
  } satisfies Fields<PlaceKind>,
  point: { x: true, y: true } satisfies Fields<Point>,
  roster: {
    allegiance: true,
    destination: true,
    encounter: true,
    facing: true,
    fighting: true,
    figure: true,
    fraction: true,
    health: true,
    icon: true,
    index: true,
    isUnit: true,
    leader: true,
    maxHealth: true,
    maxStamina: true,
    name: true,
    objects: true,
    position: true,
    route: true,
    speed: true,
    stamina: true,
    startingStrength: true,
    state: true,
    strength: true,
    ticked: true,
    trigger: true,
    triggerByte: true,
    unknown: true
  } satisfies Fields<RosterEntry>,
  state: {
    announcements: true,
    clock: true,
    council: true,
    councilPending: true,
    crossingLegs: true,
    ending: true,
    fight: true,
    meeting: true,
    movementRule: true,
    objectPlacements: true,
    passings: true,
    placeKinds: true,
    places: true,
    ringBearer: true,
    rng: true,
    roster: true,
    routes: true,
    speeds: true,
    sweepFrom: true,
    terrain: true,
    warEvents: true,
    watching: true,
    waterways: true
  } satisfies Fields<SimState>,
  warEvents: { days: true, mask: true } satisfies Fields<WarEvents>
};

const shapeOf = (shape: Record<string, Record<string, true>>): string =>
  Object.entries(shape)
    .map(([type, fields]) => `${type}(${Object.keys(fields).sort().join(',')})`)
    .sort()
    .join(' ');

// The shape each SAVE_VERSION was released with. Never edit an entry:
// when the shape changes, bump SAVE_VERSION and add a new one.
const PINNED_SHAPES: Record<number, string> = {
  1: 'clock(day,quarterHour) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(clock,placeKinds,places,ringBearer,rng,roster,routes,speeds,terrainByTile,tilemap)',
  10: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) council(ringBearer) crossingLeg(destination,rivers,riversCrossed,waypoint) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) objectPlacement(object,position) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,council,councilPending,crossingLegs,ending,fight,meeting,movementRule,objectPlacements,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrain,warEvents,watching,waterways) warEvents(days,mask)',
  2: 'clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(clock,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap)',
  3: 'clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(clock,ending,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap)',
  4: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,ending,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents) warEvents(days,mask)',
  5: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,ending,fight,meeting,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents) warEvents(days,mask)',
  6: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,ending,fight,meeting,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents,watching) warEvents(days,mask)',
  7: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) council(ringBearer) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,council,councilPending,ending,fight,meeting,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents,watching) warEvents(days,mask)',
  8: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) council(ringBearer) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) objectPlacement(object,position) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,council,councilPending,ending,fight,meeting,objectPlacements,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents,watching) warEvents(days,mask)',
  9: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) council(ringBearer) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) objectPlacement(object,position) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,council,councilPending,ending,fight,meeting,objectPlacements,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrain,warEvents,watching) warEvents(days,mask)'
};

const terrain = terrainGridOf(1, 1, () => 100);

// Encounters can stop this journey for a talk. Model the view's
// default answer so the continuation actually advances time.
const playTick = (state: SimState): SimState => {
  if (state.meeting) {
    return answerMeeting(state, 'continue-on').world;
  }
  if (state.fight) {
    return resolveFight(state);
  }
  if (state.council) {
    return closeCouncil(state);
  }
  return tickSim(state);
};

describe('save', () => {
  test('the saved shape matches the one pinned for SAVE_VERSION', () => {
    expect(shapeOf(SHAPE)).toBe(PINNED_SHAPES[SAVE_VERSION]!);
  });

  test('round-trips the state and leaves the terrain out', () => {
    const state = createSim(7, undefined, terrain);
    const data = serialiseSave(state);
    expect(data).not.toContain('"terrain"');
    expect(restoreSave(data, terrain)).toEqual({
      ok: true,
      setup: null,
      state
    });
  });

  test('keeps a Shuffled Setup beside the state; none means Classic', () => {
    const state = createSim(7, undefined, terrain);
    const data = serialiseSave(state, { seed: 1234 });
    expect(JSON.parse(data)).toMatchObject({ setup: { seed: 1234 } });
    expect(restoreSave(data, terrain)).toEqual({
      ok: true,
      setup: { seed: 1234 },
      state
    });
    expect(JSON.parse(serialiseSave(state))).not.toHaveProperty('setup');
  });

  test('round-trips the Movement rule and a waypoint, leaving the waterways out', () => {
    const waterways = loadWaterways({
      crossings: [{ at: [8, 8] }],
      rivers: [
        [
          [8, 0],
          [8, 16]
        ]
      ]
    });
    const state: SimState = {
      ...createSim(7, undefined, terrain, {
        movementRule: 'crossing',
        waterways
      }),
      crossingLegs: {
        3: {
          destination: { x: 32, y: 0 },
          rivers: [0],
          riversCrossed: [],
          waypoint: { x: 0, y: 0 }
        }
      }
    };
    const data = serialiseSave(state);
    expect(data).not.toContain('"waterways"');
    expect(restoreSave(data, terrain, waterways)).toEqual({
      ok: true,
      setup: null,
      state
    });
  });

  test('loads a version 9 save as Classic movement', () => {
    const file = JSON.parse(serialiseSave(createSim(7))) as {
      state: Record<string, unknown>;
      version: number;
    };
    delete file.state.crossingLegs;
    delete file.state.movementRule;
    file.version = 9;
    const restored = restoreSave(JSON.stringify(file), terrain);
    expect(restored).toMatchObject({
      ok: true,
      state: { crossingLegs: {}, movementRule: 'classic' }
    });
  });

  test('refuses a damaged Setup', () => {
    const file = JSON.parse(serialiseSave(createSim(7))) as {
      setup?: unknown;
    };
    for (const setup of [
      null,
      {},
      { seed: -1 },
      { seed: 1.5 },
      { seed: 2 ** 32 }
    ]) {
      file.setup = setup;
      expect(restoreSave(JSON.stringify(file), null)).toEqual({
        ok: false,
        reason: 'invalid'
      });
    }
  });

  test('refuses a save of another version, or no save at all', () => {
    const data = JSON.parse(serialiseSave(createSim(7))) as { version: number };
    data.version = SAVE_VERSION + 1;
    expect(restoreSave(JSON.stringify(data), null)).toEqual({
      ok: false,
      reason: 'other-version'
    });
    expect(restoreSave('', null)).toEqual({ ok: false, reason: 'invalid' });
    expect(restoreSave('null', null)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('refuses a damaged save rather than loading part of it', () => {
    const damaged = (state: unknown) =>
      restoreSave(JSON.stringify({ state, version: SAVE_VERSION }), null);
    const invalid = { ok: false, reason: 'invalid' } as const;
    expect(damaged(null)).toEqual(invalid);
    expect(damaged([])).toEqual(invalid);
    expect(damaged({})).toEqual(invalid);
    const { roster: _roster, ...noRoster } = JSON.parse(
      serialiseSave(createSim(7))
    ).state as Record<string, unknown>;
    expect(damaged(noRoster)).toEqual(invalid);
    expect(damaged({ ...noRoster, clock: null, roster: [] })).toEqual(invalid);
    expect(restoreSave('{"state":{', null)).toEqual(invalid);
  });

  // 0.9.0 and 1.0.0 wrote version 8, which version 9 refuses whole,
  // never loaded in part.
  test('a 1.0.0 save is refused as another version', () => {
    const file = JSON.parse(serialiseSave(createSim(7))) as {
      version: number;
    };
    file.version = 8;
    const restored = restoreSave(JSON.stringify(file), null);
    expect(restored).toEqual({ ok: false, reason: 'other-version' });
  });

  // The exported starting state is gitignored and absent in CI.
  const startingStatePath = new URL(
    '../../public/assets/starting-state.json',
    import.meta.url
  );
  const terrainPath = new URL(
    '../../public/assets/geography/terrain-regions.json',
    import.meta.url
  );
  const loadTerrain = (): TerrainGrid =>
    terrainGridFrom(
      loadTerrainRegions(JSON.parse(readFileSync(terrainPath, 'utf8')))
    );
  test.skipIf(!existsSync(startingStatePath) || !existsSync(terrainPath))(
    'save, play on, restore: the game continues identically',
    () => {
      let sim = createSim(
        0x14_18,
        JSON.parse(readFileSync(startingStatePath, 'utf8')),
        loadTerrain()
      );
      const frodo = sim.roster.find(entry => entry.name === 'FRODO')!;
      sim = giveOrder(sim, frodo.index, { x: 1500, y: 450 });
      for (let i = 0; i < 50; i++) {
        sim = playTick(sim);
      }
      const saved = serialiseSave(sim);
      let played = sim;
      for (let i = 0; i < 200; i++) {
        played = playTick(played);
      }
      expect(played).not.toEqual(sim);
      const restored = restoreSave(saved, sim.terrain);
      expect(restored).toEqual({ ok: true, setup: null, state: sim });
      if (!restored.ok) {
        return;
      }
      let replayed = restored.state;
      for (let i = 0; i < 200; i++) {
        replayed = playTick(replayed);
      }
      expect(replayed).toEqual(played);
    }
  );

  // Release acceptance (#221): a real game, saved at
  // each moment that waits on the player or interrupts the sweep, loads
  // to the same state and plays on exactly as the unsaved game does.
  // Seed 12 meets a following Character and seed 3 an Encounter's talk;
  // both later fight and queue a passing.
  test.skipIf(!existsSync(startingStatePath) || !existsSync(terrainPath))(
    'saved mid-meeting, mid-encounter, mid-fight or with a passing queued, the game continues identically',
    () => {
      const startingState: unknown = JSON.parse(
        readFileSync(startingStatePath, 'utf8')
      );
      const map = loadTerrain();
      const checked = new Set<string>();
      const check = (kind: string, state: SimState) => {
        if (checked.has(kind)) {
          return;
        }
        checked.add(kind);
        const restored = restoreSave(serialiseSave(state), map);
        expect(restored).toEqual({ ok: true, setup: null, state });
        let played = state;
        let replayed = restored.ok ? restored.state : state;
        for (let i = 0; i < 300; i++) {
          played = playTick(played);
          replayed = playTick(replayed);
        }
        expect(replayed).toEqual(played);
      };
      for (const seed of [3, 12]) {
        let sim = createSim(seed, startingState, map);
        const frodo = sim.roster.find(entry => entry.name === 'FRODO')!;
        sim = giveOrder(sim, frodo.index, RIVENDELL);
        while (!sim.ending && sim.clock.day < 60) {
          const { fight, meeting } = sim;
          if (meeting) {
            const encounter = isEncounter(meeting.a) || isEncounter(meeting.b);
            check(`${meeting.kind}${encounter ? ' encounter' : ''}`, sim);
          }
          if (fight) {
            check('fight', sim);
            check('fight after a round', fightRound(sim));
          }
          if (sim.passings.length > 0) {
            check('passing', sim);
          }
          sim = playTick(sim);
        }
      }
      expect([...checked].sort()).toEqual([
        'fight',
        'fight after a round',
        'follow',
        'passing',
        'talk encounter'
      ]);
    }
  );
});
