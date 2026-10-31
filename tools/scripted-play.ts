import { resolveFight } from '../web/src/sim/combat';
import { closeCouncil } from '../web/src/sim/council';
import { answerMeeting } from '../web/src/sim/meetings';
import type { SetupData } from '../web/src/sim/shuffled-setup';
import {
  getSimRules,
  setSimRules,
  tickSim,
  type SimRules,
  type SimState
} from '../web/src/sim/state';
import {
  loadTerrainRegions,
  terrainGridFrom,
  type TerrainGrid
} from '../web/src/sim/terrain';
import { loadWaterways, type Waterways } from '../web/src/sim/waterways';

// The parts of the scripted sim's harness (#194) that run in a browser
// as well as under Bun: the assets built from their JSON, and a step.

export interface Assets {
  startingState: SetupData;
  terrain: TerrainGrid;
  waterways: Waterways;
}

export const assetsFrom = (json: {
  startingState: unknown;
  terrain: unknown;
  waterways: unknown;
}): Assets => ({
  startingState: json.startingState as SetupData,
  terrain: terrainGridFrom(loadTerrainRegions(json.terrain)),
  waterways: loadWaterways(json.waterways)
});

// One step as the view would take it: a fight resolves, a meeting is
// passed by, the Council's message is closed, or the clock ticks. The
// rules in force before are restored after.
export const step = (sim: SimState, rules: SimRules): SimState => {
  const before = getSimRules();
  setSimRules(rules);
  try {
    if (sim.fight) {
      return resolveFight(sim);
    }
    if (sim.meeting) {
      return answerMeeting(sim, 'continue-on').world;
    }
    if (sim.council) {
      return closeCouncil(sim);
    }
    return tickSim(sim);
  } finally {
    setSimRules(before);
  }
};
