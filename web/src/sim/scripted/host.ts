import {
  ScriptError,
  createCore,
  defineCapability,
  num,
  shape,
  text,
  type Value
} from '@northtalk/ts';

import type { CrossingLeg } from '../crossing-movement';
import type { Passing } from '../encounters';
import type { Way } from '../movement';
import { nextRandom, type RngState } from '../rng';
import type { Place, Point, RosterEntry } from '../starting-state';
import type { SimState } from '../state';
import { terrainOf, type TerrainGrid } from '../terrain';
import type { WarEventAnnouncement, WarEvents } from '../war-events';
import type { Waterways } from '../waterways';
import { CROSSING } from './shipped-game/crossing';
import { QUERIES } from './shipped-game/queries';
import { SWEEP } from './shipped-game/sweep';
import { WAR_EVENTS } from './shipped-game/war-events';
import { fromValue, toValue } from './values';

// The host for the shipped game's Scenario Scripts (#194): it owns the
// state, hands the scripts the Engine Primitives and drives each request
// synchronously with one pump. The scripts never hold game state between
// requests; only the unchanging Scenario data is loaded into them, once.

// What a Run may spend. Set well above the worst sweep measured.
export const FUEL_PER_RUN = 200_000_000;

// The Engine Primitives' bindings, for the request being pumped.
interface Primitives {
  rng: RngState;
  terrain: TerrainGrid | null;
}

// The text table the export resolves the Scenario Scripts' text IDs
// into (tools/export-text-table.ts), set once the assets are loaded.
let textTable: Readonly<Record<string, string>> = {};

export const setTextTable = (table: Record<string, string>): void => {
  textTable = table;
};

const engine = defineCapability<Primitives>()('engine', {
  draw: {
    args: [shape.number],
    cost: { fuel: 2 },
    do: (call, n) => {
      const next = nextRandom(call.binding.rng);
      call.binding.rng = next.state;
      return num(Math.floor(next.value * Number(n)));
    },
    mode: 'immediate',
    result: shape.number
  },
  mark: {
    args: [],
    cost: { fuel: 1 },
    do: call => num(call.binding.rng),
    mode: 'immediate',
    result: shape.number
  },
  reset: {
    args: [shape.number],
    cost: { fuel: 1 },
    do: (call, state) => {
      call.binding.rng = Number(state);
      return num(0);
    },
    mode: 'immediate',
    result: shape.number
  },
  terrain: {
    args: [shape.number, shape.number],
    cost: { fuel: 2 },
    do: (call, x, y) =>
      num(terrainOf(call.binding.terrain, { x: Number(x), y: Number(y) })),
    mode: 'immediate',
    result: shape.number
  },
  text: {
    args: [shape.text],
    cost: { fuel: 2 },
    do: (_call, id) => {
      const found = textTable[id];
      if (found === undefined) {
        throw new ScriptError('unknown text', `No text ${id}`);
      }
      return text(found);
    },
    errors: [{ code: 'unknown text' }],
    mode: 'immediate',
    result: shape.text
  }
});

const core = createCore();

// The War Events cross as a set of event numbers (#194, decision 11).
const eventsToSet = (events: WarEvents): number[] =>
  Array.from({ length: 8 }, (_, bit) => bit).filter(
    bit => (events.mask & (1 << bit)) !== 0
  );

const eventsFromSet = (set: number[], days: number[]): WarEvents => ({
  days,
  mask: set.reduce((mask, bit) => mask | (1 << bit), 0)
});

// The Scenario Script state: what the scripts keep that the view never
// reads (#194, decisions 8 and 12).
export interface ScenarioState {
  crossingLegs: Record<number, CrossingLeg>;
}

// A save written by the TypeScript sim keeps the legs in the core state;
// the scripted sim moves them into the scenario record.
export const scenarioOf = (state: SimState): ScenarioState => ({
  crossingLegs: state.scenario?.crossingLegs ?? state.crossingLegs ?? {}
});

// The clock the host times itself by, in milliseconds. The sim is headless
// (ADR-0002), so a benchmark sets a real one.
let now: () => number = () => 0;

export const setHostClock = (clock: () => number): void => {
  now = clock;
};

export interface Timing {
  // Milliseconds converting state to Values and back, and in the pump.
  convertMs: number;
  fuel: number;
  pumpMs: number;
}

// Data as JSON, remembered per object so a tick costs one lookup.
const jsons = new WeakMap<object, string>();
const jsonOf = (data: object): string => {
  let json = jsons.get(data);
  if (json === undefined) {
    json = JSON.stringify(data);
    jsons.set(data, json);
  }
  return json;
};

export class ScriptedHost {
  readonly #primitives: Primitives = { rng: 0, terrain: null };
  readonly #group;
  readonly #script;
  // The unchanging data loaded: its Places and speeds as JSON, and the
  // waterways by identity, as a restored save shares them.
  #loaded: { json: string; waterways: Waterways | null } | null = null;
  last: Timing = { convertMs: 0, fuel: 0, pumpMs: 0 };

  constructor() {
    this.#group = core.newGroup({ name: 'scenario' });
    this.#script = this.#group.load({
      grants: {
        engine: engine.grant(
          ['draw', 'mark', 'reset', 'terrain', 'text'],
          this.#primitives
        )
      },
      limits: {
        allocPerRun: 268_435_456,
        fuelPerRun: FUEL_PER_RUN,
        persistentState: 67_108_864
      },
      name: 'shipped-game',
      source: [SWEEP, CROSSING, WAR_EVENTS, QUERIES].join('\n')
    });
  }

  // Load a game's Places, speeds and waterways, unless they are loaded.
  use(state: SimState): this {
    const places = state.places ?? [];
    const speeds = state.speeds ?? { diagonal: [], straight: [] };
    const waterways = state.waterways ?? null;
    const json = jsonOf(places) + jsonOf(speeds);
    if (this.#loaded?.json === json && this.#loaded.waterways === waterways) {
      return this;
    }
    const placeAt: Record<string, Place['position']> = {};
    for (const place of places) {
      placeAt[String(place.index)] = place.position;
    }
    this.#request('load', [toValue({ placeAt, speeds, waterways })]);
    this.#loaded = { json, waterways };
    return this;
  }

  // One request, run to its end within a single pump. It is a Delivery,
  // read from the pump's run end report: a Request's result promise
  // would hold every result until the event loop next turns, which a
  // long synchronous run of ticks never lets it do.
  #request(name: string, args: Value[]): Value {
    this.#script.deliver({ args, name });
    const pumped = this.#group.pump(0n);
    for (const report of pumped.reports) {
      if (report.kind !== 'run end') {
        continue;
      }
      this.last.fuel = report.fuel;
      if (report.outcome !== 'completed') {
        const error = report.error ?? report.limit ?? report.outcome;
        throw new Error(
          `Scenario request ${name} ended ${report.outcome}: ${String(
            report.error?.code ?? report.limit ?? ''
          )} ${JSON.stringify(report.at ?? {})}`,
          { cause: error }
        );
      }
      return report.result!;
    }
    throw new Error(`Scenario request ${name} did not end in one pump`);
  }

  // Run a request against the state, with the Engine Primitives bound to
  // its RNG and terrain, timing the conversions and the pump.
  #run(state: SimState, name: string, world: unknown, extra: Value[] = []) {
    const started = now();
    const args = [toValue(world), ...extra];
    const converted = now();
    this.#primitives.rng = state.rng;
    this.#primitives.terrain = state.terrain;
    const result = this.#request(name, args);
    const pumped = now();
    const plain = fromValue(result) as Record<string, unknown>;
    const done = now();
    this.last = {
      convertMs: converted - started + (done - pumped),
      fuel: this.last.fuel,
      pumpMs: pumped - converted
    };
    return { plain, rng: this.#primitives.rng };
  }

  // The movement sweep from state.sweepFrom, held at holdAt.
  sweep(
    state: SimState,
    holdAt: number | null
  ): { heldAt?: number; stoppedAt: number | null; world: SimState } {
    const { plain, rng } = this.#run(
      state,
      'sweep',
      {
        clock: state.clock,
        crossingLegs: scenarioOf(state).crossingLegs,
        ending: state.ending,
        fight: state.fight,
        meeting: state.meeting,
        movementRule: state.movementRule,
        passings: state.passings,
        ringBearer: state.ringBearer,
        roster: state.roster,
        routes: state.routes,
        warEvents: {
          days: state.warEvents.days,
          events: eventsToSet(state.warEvents)
        },
        watching: state.watching
      },
      [num(state.sweepFrom), toValue(holdAt)]
    );
    const world = plain.world as Record<string, unknown>;
    const warEvents = world.warEvents as { days: number[]; events: number[] };
    const next: SimState = {
      ...state,
      crossingLegs: {},
      ending: world.ending as SimState['ending'],
      fight: world.fight as SimState['fight'],
      meeting: world.meeting as SimState['meeting'],
      passings: world.passings as Passing[],
      rng,
      roster: world.roster as RosterEntry[],
      routes: world.routes as number[][],
      scenario: {
        crossingLegs: world.crossingLegs as Record<number, CrossingLeg>
      },
      warEvents: eventsFromSet(warEvents.events, warEvents.days)
    };
    return {
      ...(typeof plain.heldAt === 'number' ? { heldAt: plain.heldAt } : {}),
      stoppedAt: plain.stoppedAt as number | null,
      world: next
    };
  }

  // The world a Query of a Way reads: the roster's leader chains and
  // positions, and the Crossing legs.
  #queryWorld(state: SimState) {
    return {
      crossingLegs: scenarioOf(state).crossingLegs,
      movementRule: state.movementRule,
      roster: state.roster.map(({ destination, index, leader, position }) => ({
        destination,
        index,
        leader,
        position
      }))
    };
  }

  // The Way of the Force a roster entry is in (movement.ts, wayOf).
  wayOf(state: SimState, index: number): Way | null {
    return this.#run(state, 'wayOf', this.#queryWorld(state), [num(index)])
      .plain as unknown as Way | null;
  }

  // The Way an Order to `click` would give (movement.ts, orderedWay).
  orderedWay(state: SimState, memberIndex: number, click: Point): Way | null {
    return this.#run(state, 'orderedWay', this.#queryWorld(state), [
      num(memberIndex),
      toValue(click)
    ]).plain as unknown as Way | null;
  }

  // The text a text ID names, read through the Scenario Script.
  textOf(id: string): string {
    return fromValue(this.#request('textOf', [text(id)])) as string;
  }

  // The daily War Event check.
  dailyWarEvents(state: SimState): {
    announcements: WarEventAnnouncement[];
    events: WarEvents;
  } {
    const { plain } = this.#run(state, 'dailyWarEvents', {
      clock: state.clock,
      roster: state.roster,
      warEvents: {
        days: state.warEvents.days,
        events: eventsToSet(state.warEvents)
      }
    });
    const announcements = plain.announcements as (WarEventAnnouncement & {
      text: string;
    })[];
    const warEvents = plain.warEvents as { days: number[]; events: number[] };
    return {
      announcements: announcements.map(({ day, event }) => ({ day, event })),
      events: eventsFromSet(warEvents.events, warEvents.days)
    };
  }
}

// One host, its Group compiled once; each game's data is loaded as the
// game changes.
let host: ScriptedHost | null = null;

export const hostFor = (state: SimState): ScriptedHost =>
  (host ??= new ScriptedHost()).use(state);
