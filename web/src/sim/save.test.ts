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
import { isEncounter, type Passing } from './encounters';
import { answerMeeting, type Meeting } from './meetings';
import { giveOrder, type Tilemap } from './movement';
import { SAVE_VERSION, restoreSave, serialiseSave } from './save';
import type {
  ObjectPlacement,
  Place,
  PlaceKind,
  Point,
  RosterEntry
} from './starting-state';
import { createSim, tickSim, type SimState } from './state';
import type { WarEventAnnouncement, WarEvents } from './war-events';

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
    ending: true,
    fight: true,
    meeting: true,
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
    terrainByTile: true,
    tilemap: true,
    warEvents: true,
    watching: true
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
  2: 'clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(clock,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap)',
  3: 'clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(clock,ending,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap)',
  4: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,ending,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents) warEvents(days,mask)',
  5: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,ending,fight,meeting,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents) warEvents(days,mask)',
  6: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,ending,fight,meeting,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents,watching) warEvents(days,mask)',
  7: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) council(ringBearer) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,council,councilPending,ending,fight,meeting,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents,watching) warEvents(days,mask)',
  8: 'announcement(day,event) clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) council(ringBearer) fight(events,evil,good,position,round,rows,winner) meeting(a,b,kind) objectPlacement(object,position) passing(a,b) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(announcements,clock,council,councilPending,ending,fight,meeting,objectPlacements,passings,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap,warEvents,watching) warEvents(days,mask)'
};

const tilemap = { height: 1, indices: [0], width: 1 };

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

  test('round-trips the state and leaves the tilemap out', () => {
    const state = createSim(7, undefined, tilemap);
    const data = serialiseSave(state);
    expect(data).not.toContain('"tilemap"');
    expect(restoreSave(data, tilemap)).toEqual({ ok: true, state });
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

  // 0.9.0 wrote version 8: its saves load while that is still the
  // version, and are refused whole, never loaded in part, once it isn't.
  test('a 0.9.0 save loads, or is refused as another version', () => {
    const file = JSON.parse(serialiseSave(createSim(7))) as {
      version: number;
    };
    file.version = 8;
    const restored = restoreSave(JSON.stringify(file), null);
    expect(restored.ok || restored.reason).toBe(
      SAVE_VERSION === 8 ? true : 'other-version'
    );
  });

  // The exported starting state is gitignored and absent in CI.
  const startingStatePath = new URL(
    '../../public/assets/starting-state.json',
    import.meta.url
  );
  const tilemapPath = new URL(
    '../../public/assets/campaign/tilemap.json',
    import.meta.url
  );
  test.skipIf(!existsSync(startingStatePath) || !existsSync(tilemapPath))(
    'save, play on, restore: the game continues identically',
    () => {
      let sim = createSim(
        0x14_18,
        JSON.parse(readFileSync(startingStatePath, 'utf8')),
        JSON.parse(readFileSync(tilemapPath, 'utf8'))
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
      const restored = restoreSave(saved, sim.tilemap);
      expect(restored).toEqual({ ok: true, state: sim });
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
  test.skipIf(!existsSync(startingStatePath) || !existsSync(tilemapPath))(
    'saved mid-meeting, mid-encounter, mid-fight or with a passing queued, the game continues identically',
    () => {
      const startingState: unknown = JSON.parse(
        readFileSync(startingStatePath, 'utf8')
      );
      const map = JSON.parse(readFileSync(tilemapPath, 'utf8')) as Tilemap;
      const checked = new Set<string>();
      const check = (kind: string, state: SimState) => {
        if (checked.has(kind)) {
          return;
        }
        checked.add(kind);
        const restored = restoreSave(serialiseSave(state), map);
        expect(restored).toEqual({ ok: true, state });
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
