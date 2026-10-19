// The starting state recovered from the Reference Build
// (docs/spec/starting-state.md): the roster of Characters and Units, the
// Places and the Forces they form. The view fetches
// starting-state.json, exported by `bun run export:web`, and hands the
// parsed JSON to createSim; the sim loads it here rather than copying
// its values into code, so the start of the game cannot drift from the
// Reference Build. Field meanings are in
// finding:data-formats-roster-record-layout.

export interface Point {
  x: number;
  y: number;
}

// The condition that wakes or mobilises an entry
// (finding:ai-trigger-conditions), as the extractor decodes it.
export type Trigger =
  | { kind: 'none' }
  | { event_bit: 0; kind: 'near-ring-bearer' }
  | { event_bit: 2; kind: 'near-gandalf' }
  | { event_bit: number; kind: 'on-event' }
  | { days_after: number; event_bit: number; kind: 'after-event' };

export interface RosterEntry {
  allegiance: number;
  destination: Point | null;
  // Entries after 151 only: where and how often they are met
  // (finding:forces-encounter-figures-wait-in-areas).
  encounter: {
    area: { bottom: number; left: number; right: number; top: number };
    chance: number;
    earliestDay: number;
  } | null;
  facing: number;
  fighting: number;
  figure: number;
  health: number;
  icon: number;
  index: number;
  // A Unit has a starting strength above 1, otherwise a Character
  // (finding:forces-units-have-strength-above-one).
  isUnit: boolean;
  leader: number | null;
  maxHealth: number;
  maxStamina: number;
  name: string;
  objects: number[];
  position: Point | null;
  route: number;
  speed: number;
  stamina: number;
  startingStrength: number;
  // 0 asleep, 1 moving, 3 resting (finding:data-formats-roster-record-layout).
  state: number;
  strength: number;
  ticked: boolean;
  trigger: Trigger;
  triggerByte: number;
  // Raw values whose meaning is not settled
  // (finding:data-formats-roster-unsettled-fields).
  unknown: { b19: number; b24: number; b29: number | null };
}

export interface Place {
  announcesAttacks: boolean;
  gridByte: number;
  gridReference: string | null;
  index: number;
  name: string;
  position: Point;
  tile: Point;
  // The generic kind of the tile under the Place, if any. An inference:
  // named Places have no kind of their own
  // (finding:places-kinds-matched-by-map-tile).
  tileKind: string | null;
}

export interface PlaceKind {
  index: number;
  name: string;
  tile: number;
}

export interface StartingState {
  clock: { day: number; quarterHour: number };
  placeKinds: PlaceKind[];
  places: Place[];
  ringBearer: number;
  roster: RosterEntry[];
}

export interface Force {
  // The player can control an active Force, and its icon flashes
  // (finding:movement-only-active-forces-take-orders). The original
  // blinks the icons of leaders whose allegiance is above 2
  // (finding:mobilisation-allegiance-byte).
  active: boolean;
  leader: RosterEntry;
  // The Leader first, then each follower in roster order.
  members: RosterEntry[];
  // Only Forces whose Leader is awake are drawn on the Campaign Level
  // (finding:forces-starting-forces-on-the-map).
  onMap: boolean;
  position: Point;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (what: string): never => {
  throw new Error(`Not a starting state: ${what}`);
};

const num = (value: unknown, what: string): number =>
  typeof value === 'number' ? value : fail(`${what} is not a number`);

const str = (value: unknown, what: string): string =>
  typeof value === 'string' ? value : fail(`${what} is not a string`);

const pointOrNull = (value: unknown, what: string): Point | null => {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return fail(`${what} is not a point`);
  }
  return { x: num(value.x, `${what}.x`), y: num(value.y, `${what}.y`) };
};

const point = (value: unknown, what: string): Point =>
  pointOrNull(value, what) ?? fail(`${what} is not a point`);

const loadRosterEntry = (value: unknown, index: number): RosterEntry => {
  if (!isRecord(value)) {
    return fail(`roster[${index}] is not an object`);
  }
  const what = `roster[${index}]`;
  const encounter = value.encounter;
  const unknown = isRecord(value.unknown) ? value.unknown : {};
  return {
    allegiance: num(value.allegiance, `${what}.allegiance`),
    destination: pointOrNull(value.destination, `${what}.destination`),
    encounter: isRecord(encounter)
      ? {
          area: {
            bottom: num(
              isRecord(encounter.area) ? encounter.area.bottom : null,
              `${what}.encounter.area.bottom`
            ),
            left: num(
              isRecord(encounter.area) ? encounter.area.left : null,
              `${what}.encounter.area.left`
            ),
            right: num(
              isRecord(encounter.area) ? encounter.area.right : null,
              `${what}.encounter.area.right`
            ),
            top: num(
              isRecord(encounter.area) ? encounter.area.top : null,
              `${what}.encounter.area.top`
            )
          },
          chance: num(encounter.chance, `${what}.encounter.chance`),
          earliestDay: num(
            encounter.earliest_day,
            `${what}.encounter.earliest_day`
          )
        }
      : null,
    facing: num(value.facing, `${what}.facing`),
    fighting: num(value.fighting, `${what}.fighting`),
    figure: num(value.figure, `${what}.figure`),
    health: num(value.health, `${what}.health`),
    icon: num(value.icon, `${what}.icon`),
    index: num(value.index, `${what}.index`),
    isUnit: value.is_unit === true,
    leader: value.leader === null ? null : num(value.leader, `${what}.leader`),
    maxHealth: num(value.max_health, `${what}.max_health`),
    maxStamina: num(value.max_stamina, `${what}.max_stamina`),
    name: str(value.name, `${what}.name`),
    objects: Array.isArray(value.objects)
      ? value.objects.map((object, i) => num(object, `${what}.objects[${i}]`))
      : fail(`${what}.objects is not an array`),
    position: pointOrNull(value.position, `${what}.position`),
    route: num(value.route, `${what}.route`),
    speed: num(value.speed, `${what}.speed`),
    stamina: num(value.stamina, `${what}.stamina`),
    startingStrength: num(value.starting_strength, `${what}.starting_strength`),
    state: num(value.state, `${what}.state`),
    strength: num(value.strength, `${what}.strength`),
    ticked: value.ticked === true,
    trigger: isRecord(value.trigger)
      ? (value.trigger as Trigger)
      : fail(`${what}.trigger is not an object`),
    triggerByte: num(value.trigger_byte, `${what}.trigger_byte`),
    unknown: {
      b19: num(unknown.b19, `${what}.unknown.b19`),
      b24: num(unknown.b24, `${what}.unknown.b24`),
      b29: unknown.b29 === null ? null : num(unknown.b29, `${what}.unknown.b29`)
    }
  };
};

const loadPlace = (value: unknown, index: number): Place => {
  if (!isRecord(value)) {
    return fail(`places[${index}] is not an object`);
  }
  const what = `places[${index}]`;
  return {
    announcesAttacks: value.announces_attacks === true,
    gridByte: num(value.grid_byte, `${what}.grid_byte`),
    gridReference:
      value.grid_reference === null
        ? null
        : str(value.grid_reference, `${what}.grid_reference`),
    index: num(value.index, `${what}.index`),
    name: str(value.name, `${what}.name`),
    position: point(value.position, `${what}.position`),
    tile: point(value.tile, `${what}.tile`),
    tileKind:
      value.tile_kind === null
        ? null
        : str(value.tile_kind, `${what}.tile_kind`)
  };
};

// Validate and convert the exported starting-state.json. Anything that
// is not the file the extractor writes is rejected whole, so a bad
// asset fails loudly at load instead of half-filling the simulation.
export const loadStartingState = (json: unknown): StartingState => {
  if (!isRecord(json)) {
    return fail('not an object');
  }
  if (!Array.isArray(json.roster) || json.roster.length === 0) {
    return fail('roster is not a non-empty array');
  }
  if (!Array.isArray(json.places) || json.places.length === 0) {
    return fail('places is not a non-empty array');
  }
  if (!Array.isArray(json.place_kinds)) {
    return fail('place_kinds is not an array');
  }
  const clock = isRecord(json.clock) ? json.clock : fail('clock is missing');
  const events = isRecord(json.events)
    ? json.events
    : fail('events is missing');
  return {
    clock: {
      day: num(clock.day, 'clock.day'),
      quarterHour: num(clock.quarter_hour, 'clock.quarter_hour')
    },
    placeKinds: json.place_kinds.map((kind, i) => {
      if (!isRecord(kind)) {
        return fail(`place_kinds[${i}] is not an object`);
      }
      return {
        index: num(kind.index, `place_kinds[${i}].index`),
        name: str(kind.name, `place_kinds[${i}].name`),
        tile: num(kind.tile, `place_kinds[${i}].tile`)
      };
    }),
    places: json.places.map(loadPlace),
    ringBearer: num(events.ring_bearer, 'events.ring_bearer'),
    roster: json.roster.map(loadRosterEntry)
  };
};

// The Leader at the end of an entry's chain of leaders
// (finding:forces-leader-byte-forms-forces).
export const topLeader = (
  roster: RosterEntry[],
  entry: RosterEntry
): RosterEntry => {
  const seen = new Set<number>();
  let current = entry;
  while (current.leader !== null) {
    if (seen.has(current.index)) {
      throw new Error(`Leader loop at roster entry ${entry.index}`);
    }
    seen.add(current.index);
    const next = roster[current.leader];
    if (!next) {
      throw new Error(
        `Roster entry ${current.index} follows missing entry ${current.leader}`
      );
    }
    current = next;
  }
  return current;
};

// Every Force among the ticked entries: a Leader with no leader of its
// own together with everyone whose chain of leaders ends at it
// (finding:forces-leader-byte-forms-forces). A Force is at its Leader's
// position; followers have no position of their own at the start.
export const forcesOf = (roster: RosterEntry[]): Force[] => {
  const byLeader = new Map<number, Force>();
  const forces: Force[] = [];
  for (const entry of roster) {
    if (!entry.ticked) {
      continue;
    }
    const leader = topLeader(roster, entry);
    if (!leader.position) {
      continue;
    }
    let force = byLeader.get(leader.index);
    if (!force) {
      force = {
        active: leader.allegiance > 2,
        leader,
        members: [leader],
        onMap: leader.state !== 0,
        position: leader.position
      };
      byLeader.set(leader.index, force);
      forces.push(force);
    }
    if (entry.index !== leader.index) {
      force.members.push(entry);
    }
  }
  return forces.toSorted((a, b) => a.leader.index - b.leader.index);
};

// The Forces drawn on the Campaign Level: those whose Leader is awake
// (finding:forces-starting-forces-on-the-map).
export const forcesOnMap = (roster: RosterEntry[]): Force[] =>
  forcesOf(roster).filter(force => force.onMap);

// Positions are Campaign Level pixels; the tile under a position is
// (x ÷ 16, y ÷ 16) (finding:map-positions-are-campaign-pixels).
export const TILE_SIZE = 16;

export const tileOf = (position: Point): Point => ({
  x: Math.floor(position.x / TILE_SIZE),
  y: Math.floor(position.y / TILE_SIZE)
});

// The named Place at a point, if any. A point is at a named Place only
// if its tile is the Place's tile
// (finding:places-named-places-matched-by-position).
export const placeAt = (places: Place[], position: Point): Place | null => {
  const tile = tileOf(position);
  return (
    places.find(place => place.tile.x === tile.x && place.tile.y === tile.y) ??
    null
  );
};

// The generic Place kind for a map tile number, such as "a small town",
// if the tile has one (finding:places-kinds-matched-by-map-tile). The
// tile number itself comes from the Campaign Level tile map, which
// only the view loads (ADR-0002).
export const placeKindForTile = (
  placeKinds: PlaceKind[],
  tileNumber: number
): string | null =>
  placeKinds.find(kind => kind.tile === tileNumber)?.name ?? null;
