// The port's Setup generator; this is Scenario design, not original
// behaviour (docs/spec/shuffled-setup.md). It works on the exported JSON,
// before createSim loads it, and never consumes the simulation's RNG.
import { isEncounter } from './encounters';
import { createRng, nextRandom } from './rng';
import { ENCOUNTER_LIMITS, NAZGUL_LIMITS, OBJECT_LIMITS } from './setup-limits';
import {
  TILE_SIZE,
  tileOf,
  type ObjectPlacement,
  type Point
} from './starting-state';

export const SETUP_AXES = ['a', 'b', 'c'] as const;
export type SetupAxis = (typeof SETUP_AXES)[number];

// Only the fields these axes need. Generic callers keep every other field
// in their input, including extractor metadata, with its original type.
export interface SetupData {
  object_placements: ObjectPlacement[];
  places: { index: number; position: Point }[];
  roster: {
    encounter: {
      area: { bottom: number; left: number; right: number; top: number };
      chance: number;
      earliest_day: number;
    } | null;
    index: number;
    position: Point | null;
  }[];
}

// Permanent stream identifiers: future axes use their own salt and RNG.
// No axis draws from another's stream, even when the other is disabled.
export const setupAxisRng = (seed: number, axis: SetupAxis): number =>
  createRng(seed ^ { a: 0x61, b: 0x62, c: 0x63 }[axis]);

export const validateSetupAxes = (axes: readonly SetupAxis[]): void => {
  if (new Set(axes).size !== axes.length) {
    throw new Error('Setup axes must be unique');
  }
  for (const axis of axes) {
    if (!(axis in AXIS_SHUFFLES)) {
      throw new Error(`Setup axis ${axis} is not implemented`);
    }
  }
};

const tileKey = (position: Point): string => {
  const tile = tileOf(position);
  return `${tile.x},${tile.y}`;
};

// Positions of Places by index, throwing for one the limits name but the
// Setup lacks.
const placeLookup = (
  classic: SetupData,
  limits: string
): ((index: number) => Point) => {
  const places = new Map(classic.places.map(place => [place.index, place]));
  return index => {
    const place = places.get(index);
    if (!place) {
      throw new Error(`${limits} limits reference missing Place ${index}`);
    }
    return place.position;
  };
};

// Draws integers below count from one axis's stream.
const axisDraw = (
  seed: number,
  axis: SetupAxis
): ((count: number) => number) => {
  let rng = setupAxisRng(seed, axis);
  return count => {
    const next = nextRandom(rng);
    rng = next.state;
    return Math.floor(next.value * count);
  };
};

const shuffleObjects = (
  classic: SetupData,
  seed: number
): ObjectPlacement[] => {
  if (
    classic.object_placements.length !== OBJECT_LIMITS.length ||
    OBJECT_LIMITS.some(
      (limit, slot) => limit.object !== classic.object_placements[slot]?.object
    )
  ) {
    throw new Error('Object limits do not match the Classic placement slots');
  }
  const position = placeLookup(classic, 'Object');
  const draw = axisDraw(seed, 'a');
  const candidates = OBJECT_LIMITS.map(limit => {
    const positions = limit.places.map(position);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = draw(i + 1);
      [positions[i], positions[j]] = [positions[j]!, positions[i]!];
    }
    return positions;
  });

  // Bipartite matching: random candidate preferences, deterministic
  // reassignment. A greedy placement can strand a later slot even when a
  // complete assignment exists. No retries or out-of-limit fallbacks.
  const occupied = new Map<string, number>();
  const assigned = new Map<number, Point>();
  const assign = (slot: number, visited: Set<string>): boolean => {
    for (const position of candidates[slot]!) {
      const key = tileKey(position);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const previous = occupied.get(key);
      if (previous === undefined || assign(previous, visited)) {
        occupied.set(key, slot);
        assigned.set(slot, position);
        return true;
      }
    }
    return false;
  };
  classic.object_placements.forEach((_, slot) => {
    if (!assign(slot, new Set())) {
      throw new Error('Object limits cannot assign distinct tiles');
    }
  });
  return classic.object_placements.map((placement, slot) => ({
    ...placement,
    position: { ...assigned.get(slot)! }
  }));
};

const shuffleEncounters = (
  classic: SetupData,
  seed: number
): SetupData['roster'] => {
  const limits = new Map(ENCOUNTER_LIMITS.map(limit => [limit.roster, limit]));
  const figures = classic.roster.filter(entry => isEncounter(entry.index));
  if (
    figures.length !== ENCOUNTER_LIMITS.length ||
    new Set(figures.map(entry => entry.index)).size !== limits.size ||
    figures.some(entry => !entry.encounter || !limits.has(entry.index))
  ) {
    throw new Error('Encounter limits do not match the Classic roster');
  }
  const position = placeLookup(classic, 'Encounter');
  const corner = (index: number): Point => tileOf(position(index));
  const draw = axisDraw(seed, 'b');
  // Walk the design rows, so incidental roster array ordering cannot change
  // which figure receives a draw. No draw comes from the object stream.
  const encounters = new Map(
    ENCOUNTER_LIMITS.map(limit => {
      const candidate = limit.areas[draw(limit.areas.length)]!;
      const a = corner(candidate[0]);
      const b = corner(candidate[1]);
      const [first, last] = limit.firstDay;
      return [
        limit.roster,
        {
          area: {
            bottom: (Math.max(a.y, b.y) + 1) * TILE_SIZE - 1,
            left: Math.min(a.x, b.x) * TILE_SIZE,
            right: (Math.max(a.x, b.x) + 1) * TILE_SIZE - 1,
            top: Math.min(a.y, b.y) * TILE_SIZE
          },
          earliest_day: first + draw(last - first + 1)
        }
      ];
    })
  );
  return classic.roster.map(entry => {
    const shuffled = encounters.get(entry.index);
    return shuffled
      ? { ...entry, encounter: { ...entry.encounter!, ...shuffled } }
      : entry;
  });
};

const shuffleNazgul = (
  classic: SetupData,
  seed: number
): SetupData['roster'] => {
  const riders = classic.roster.filter(
    entry =>
      entry.index >= NAZGUL_LIMITS[0]!.roster &&
      entry.index <= NAZGUL_LIMITS.at(-1)!.roster
  );
  if (
    riders.length !== NAZGUL_LIMITS.length ||
    NAZGUL_LIMITS.some(
      limit => !riders.some(entry => entry.index === limit.roster)
    ) ||
    riders.some(entry => !entry.position)
  ) {
    throw new Error('Nazgûl limits do not match the Classic roster');
  }
  const position = placeLookup(classic, 'Nazgûl');
  const draw = axisDraw(seed, 'c');
  // Only the start moves: destination and route, the rider's Default
  // Orders, stay as they are (finding:ai-default-orders-are-place-queues).
  const starts = new Map(
    NAZGUL_LIMITS.map(limit => [
      limit.roster,
      position(limit.places[draw(limit.places.length)]!)
    ])
  );
  return classic.roster.map(entry => {
    const start = starts.get(entry.index);
    return start ? { ...entry, position: { ...start } } : entry;
  });
};

// Each implemented axis, and the Setup fields it replaces. Axes b and c both
// replace the roster, so each works on the Setup so far; they change
// disjoint fields and never read what another axis changed, so their order
// cannot matter.
const AXIS_SHUFFLES: Partial<
  Record<SetupAxis, (classic: SetupData, seed: number) => Partial<SetupData>>
> = {
  a: (classic, seed) => ({ object_placements: shuffleObjects(classic, seed) }),
  b: (classic, seed) => ({ roster: shuffleEncounters(classic, seed) }),
  c: (classic, seed) => ({ roster: shuffleNazgul(classic, seed) })
};

export const shuffleSetup = <T extends SetupData>(
  classic: T,
  seed: number,
  axes: readonly SetupAxis[]
): T => {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xff_ff_ff_ff) {
    throw new Error('Setup seed must be an unsigned 32-bit integer');
  }
  validateSetupAxes(axes);
  return axes.reduce(
    (setup, axis) => ({ ...setup, ...AXIS_SHUFFLES[axis]!(setup, seed) }),
    classic
  );
};
