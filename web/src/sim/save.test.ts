import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import type { Clock } from './clock';
import type { CombatEvent, CombatRow, Fight } from './combat';
import { giveOrder } from './movement';
import { SAVE_VERSION, restoreSave, serialiseSave } from './save';
import type { Place, PlaceKind, Point, RosterEntry } from './starting-state';
import { createSim, tickSim, type SimState } from './state';

// Every field of the saved state, nested types included. Adding a field
// to any of these types breaks the typecheck here until it is listed,
// and listing it changes the shape below.
type Fields<T> = { [K in keyof Required<T>]: true };
const SHAPE = {
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
  fight: {
    events: true,
    evil: true,
    good: true,
    position: true,
    round: true,
    rows: true,
    winner: true
  } satisfies Fields<Fight>,
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
    clock: true,
    ending: true,
    fight: true,
    placeKinds: true,
    places: true,
    ringBearer: true,
    rng: true,
    roster: true,
    routes: true,
    speeds: true,
    sweepFrom: true,
    terrainByTile: true,
    tilemap: true
  } satisfies Fields<SimState>
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
  3: 'clock(day,quarterHour) combatEvent(blow,killed,row,wounded) combatRow(entries,follower,option,side,startStrength,strength) fight(events,evil,good,position,round,rows,winner) place(announcesAttacks,gridByte,gridReference,index,name,position,tile,tileKind) placeKind(index,name,tile) point(x,y) roster(allegiance,destination,encounter,facing,fighting,figure,fraction,health,icon,index,isUnit,leader,maxHealth,maxStamina,name,objects,position,route,speed,stamina,startingStrength,state,strength,ticked,trigger,triggerByte,unknown) state(clock,ending,fight,placeKinds,places,ringBearer,rng,roster,routes,speeds,sweepFrom,terrainByTile,tilemap)'
};

const tilemap = { height: 1, indices: [0], width: 1 };

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
        sim = tickSim(sim);
      }
      const saved = serialiseSave(sim);
      let played = sim;
      for (let i = 0; i < 200; i++) {
        played = tickSim(played);
      }
      expect(played).not.toEqual(sim);
      const restored = restoreSave(saved, sim.tilemap);
      expect(restored).toEqual({ ok: true, state: sim });
      if (!restored.ok) {
        return;
      }
      let replayed = restored.state;
      for (let i = 0; i < 200; i++) {
        replayed = tickSim(replayed);
      }
      expect(replayed).toEqual(played);
    }
  );
});
