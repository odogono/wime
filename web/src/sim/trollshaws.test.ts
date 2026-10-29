import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { resolveFight } from './combat';
import { closeCouncil } from './council';
import { answerMeeting } from './meetings';
import { giveOrder } from './movement';
import { createSim, tickSim, type SimState } from './state';
import { loadTerrainRegions, terrainGridFrom } from './terrain';

// Frodo's road from Bree to Rivendell runs through the Trollshaws,
// where an Evil Encounter can kill the Fellowship short of Rivendell
// (#343): the dead stand where they fell with strength and state 0,
// and the 3rd Nazgûl is sent for the Ring
// (finding:combat-evil-encounters-attack,
// finding:objects-encounter-revives-third-nazgul).

// The exported assets are gitignored and absent in CI.
const startingStatePath = new URL(
  '../../public/assets/starting-state.json',
  import.meta.url
);
const terrainPath = new URL(
  '../../public/assets/geography/terrain-regions.json',
  import.meta.url
);
const assetsMissing =
  !existsSync(startingStatePath) || !existsSync(terrainPath);

const FRODO = 7;
const SAM = 8;
const PIPPIN = 10;
const THIRD_NAZGUL = 81;
const TROLLS = 173;
const BREE = { x: 784, y: 384 };
const RIVENDELL = { x: 1216, y: 384 };

// Frodo, Sam and Pippin at Bree, ordered to Rivendell; nobody else moves.
const fromBree = (seed: number): SimState => {
  const sim = createSim(
    seed,
    JSON.parse(readFileSync(startingStatePath, 'utf8')),
    terrainGridFrom(
      loadTerrainRegions(JSON.parse(readFileSync(terrainPath, 'utf8')))
    )
  );
  const roster = sim.roster.map(entry =>
    entry.index === FRODO
      ? { ...entry, position: { ...BREE }, state: 1 }
      : entry.index === SAM || entry.index === PIPPIN
        ? entry
        : { ...entry, ticked: false }
  );
  return giveOrder({ ...sim, roster }, FRODO, RIVENDELL);
};

// Play until Frodo arrives or dies, noting who he fights.
const walk = (initial: SimState) => {
  let sim = initial;
  const foes: number[] = [];
  for (let i = 0; i < 3000; i++) {
    const frodo = sim.roster[FRODO]!;
    if (frodo.strength === 0 || frodo.destination === null) {
      break;
    }
    if (sim.fight) {
      foes.push(sim.fight.evil);
      sim = resolveFight(sim);
    } else if (sim.meeting) {
      sim = answerMeeting(sim, 'continue-on').world;
    } else if (sim.council) {
      sim = closeCouncil(sim);
    } else {
      sim = tickSim(sim);
    }
  }
  return { foes, sim };
};

describe.skipIf(assetsMissing)('the road from Bree to Rivendell', () => {
  test('trolls in the Trollshaws can kill the Fellowship, and the 3rd Nazgûl takes the Ring', () => {
    const { foes, sim } = walk(fromBree(2));
    const frodo = sim.roster[FRODO]!;
    expect(foes.at(-1)).toBe(TROLLS);
    expect(frodo.position).toEqual({ x: 1136, y: 400 });
    expect(frodo.strength).toBe(0);
    expect(frodo.state).toBe(0);
    expect(sim.ringBearer).toBe(THIRD_NAZGUL);
  });

  test('without a deadly Encounter, Frodo arrives', () => {
    const { sim } = walk(fromBree(3));
    expect(sim.roster[FRODO]!.position).toEqual(RIVENDELL);
    expect(sim.ringBearer).toBe(FRODO);
  });
});
