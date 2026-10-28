import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { resolveFight } from './combat';
import { closeCouncil } from './council';
import { BARAD_DUR_GARRISON } from './endings';
import { answerMeeting } from './meetings';
import { giveOrder } from './movement';
import { RING } from './objects';
import { BARAD_DUR, MOUNT_DOOM } from './ring';
import type { Point, RosterEntry } from './starting-state';
import { createSim, tickSim, type SimState } from './state';
import { loadTerrainRegions, terrainGridFrom } from './terrain';

// Release acceptance (#220): from the real starting state, each of the
// four endings is reached by playing ticks, and once it is reached the
// game stands still (docs/spec/winning-and-losing.md).

// The exported assets are gitignored and absent in CI.
const startingStatePath = new URL(
  '../../public/assets/starting-state.json',
  import.meta.url
);
const terrainPath = new URL(
  '../../public/assets/geography/terrain-regions.json',
  import.meta.url
);

const start = (): SimState =>
  createSim(
    0x2_20,
    JSON.parse(readFileSync(startingStatePath, 'utf8')),
    terrainGridFrom(
      loadTerrainRegions(JSON.parse(readFileSync(terrainPath, 'utf8')))
    )
  );

const MINAS_TIRITH_GARRISON = 33;
const EDORAS_GARRISON = 67;
const HORNBURG_GARRISON = 68;
const HORNBURG: Point = { x: 1168, y: 960 };
const THIRD_NAZGUL = 81;
// Evil orcs south of Barad-dûr, and the Good Hornburg infantry.
const ORCS = 120;
const FRODO = 7;

const change = (
  sim: SimState,
  index: number,
  over: Partial<RosterEntry>
): SimState => ({
  ...sim,
  roster: sim.roster.map(entry =>
    entry.index === index ? { ...entry, ...over } : entry
  )
});

// Play as the view would: fights resolve, meetings are passed by and
// the Council's message is closed, until the game ends.
const playToEnding = (initial: SimState, limit = 20_000): SimState => {
  let sim = initial;
  for (let i = 0; i < limit && !sim.ending; i++) {
    if (sim.fight) {
      sim = resolveFight(sim);
    } else if (sim.meeting) {
      sim = answerMeeting(sim, 'continue-on').world;
    } else if (sim.council) {
      sim = closeCouncil(sim);
    } else {
      sim = tickSim(sim);
    }
  }
  return sim;
};

const expectStandsStill = (sim: SimState): void => {
  expect(tickSim(sim)).toBe(sim);
  const ordered = giveOrder(sim, FRODO, { x: 1500, y: 450 });
  expect(tickSim(ordered).clock).toEqual(sim.clock);
};

const assetsMissing =
  !existsSync(startingStatePath) || !existsSync(terrainPath);

describe.skipIf(assetsMissing)(
  'the four endings, from the starting state',
  () => {
    test('the Ring-bearer walking onto Mount Doom wins', () => {
      const near = { x: MOUNT_DOOM.x - 16, y: MOUNT_DOOM.y };
      let sim = change(start(), FRODO, { position: near, state: 1 });
      sim = giveOrder(sim, FRODO, MOUNT_DOOM);
      const ended = playToEnding(sim);
      expect(ended.ending).toBe('won-mount-doom');
      expect(ended.roster[FRODO]!.position).toEqual(MOUNT_DOOM);
      expectStandsStill(ended);
    });

    test('destroying the Garrison of Barad-dûr wins', () => {
      const near = { x: BARAD_DUR.x - 16, y: BARAD_DUR.y };
      const sim = change(start(), HORNBURG_GARRISON, {
        destination: { ...BARAD_DUR },
        position: near,
        startingStrength: 60_000,
        state: 1,
        strength: 60_000
      });
      const ended = playToEnding(sim);
      expect(ended.ending).toBe('won-barad-dur');
      expect(ended.roster[BARAD_DUR_GARRISON]!.strength).toBe(0);
      expectStandsStill(ended);
    });

    test('an Evil Leader carrying the Ring onto Barad-dûr loses', () => {
      let sim = change(start(), FRODO, { objects: [] });
      sim = change(sim, THIRD_NAZGUL, {
        destination: { ...BARAD_DUR },
        objects: [RING],
        position: { x: BARAD_DUR.x - 16, y: BARAD_DUR.y },
        state: 1
      });
      sim = { ...sim, ringBearer: THIRD_NAZGUL };
      const ended = playToEnding(sim);
      expect(ended.ending).toBe('lost-barad-dur');
      expect(ended.roster[THIRD_NAZGUL]!.position).toEqual(BARAD_DUR);
      expectStandsStill(ended);
    });

    test('a third Stronghold falling loses', () => {
      let sim = change(start(), MINAS_TIRITH_GARRISON, {
        state: 0,
        strength: 0
      });
      sim = change(sim, EDORAS_GARRISON, { state: 0, strength: 0 });
      sim = change(sim, ORCS, {
        destination: { ...HORNBURG },
        position: { x: HORNBURG.x + 16, y: HORNBURG.y },
        startingStrength: 60_000,
        state: 1,
        strength: 60_000
      });
      const ended = playToEnding(sim);
      expect(ended.ending).toBe('lost-strongholds');
      expect(ended.roster[HORNBURG_GARRISON]!.strength).toBe(0);
      expectStandsStill(ended);
    });
  }
);
