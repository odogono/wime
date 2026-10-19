#!/usr/bin/env bun
// Extract the starting state of the game from the Amiga executable.
//
//   bun tools/extract-starting-state.ts [ARCHIVE] [--out DIR] [--overlay PNG]
//
// ARCHIVE defaults to the Reference Build in artifacts/amiga/. The JSON goes
// to web/public/assets/starting-state.json by default (gitignored). With
// --overlay, every Place and Force is also drawn over the rendered Campaign
// Level map, to check the positions by eye.
//
// The tables live in the executable's initialised data hunk. Their layout is
// in docs/re/starting-state-tables.md and the facts in docs/findings/; the
// offsets below are data hunk offsets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  AmigaOFSImage,
  DEFAULT_ARCHIVE,
  ExtractError,
  beU16,
  beU32,
  loadLhaMember,
  stringifySortedJson,
  writeRgbaPng
} from './extract-graphics';
import { EXECUTABLE_FILE, EXECUTABLE_MEMBER } from './extract-text';
import {
  loadCampaignMapAssets,
  renderRawMap,
  type CampaignMapAssets
} from './render-campaign-map';
import { drawSheetLabel, type RgbaImage } from './sheet-font';

export const STARTING_STATE_FILE = 'starting-state.json';

// AmigaDOS hunk types (finding:executable-amiga-hunk-file).
const HUNK_HEADER = 0x03_f3;
const HUNK_CODE = 0x03_e9;
const HUNK_DATA = 0x03_ea;
const HUNK_BSS = 0x03_eb;
const HUNK_RELOC32 = 0x03_ec;
const HUNK_SYMBOL = 0x03_f0;
const HUNK_END = 0x03_f2;

export type Hunk = {
  data: Uint8Array;
  // Target hunk -> offsets in this hunk holding a 32-bit pointer into it.
  relocs: Map<number, number[]>;
  size: number;
  type: 'bss' | 'code' | 'data';
};

// Split an AmigaDOS load file into its hunks. Only the hunk types the
// Reference Build uses are handled.
export const parseHunkFile = (file: Uint8Array): Hunk[] => {
  let offset = 0;
  const next = (): number => {
    if (offset + 4 > file.length) {
      throw new ExtractError('hunk file ends early');
    }
    const value = beU32(file, offset);
    offset += 4;
    return value;
  };

  if (next() !== HUNK_HEADER) {
    throw new ExtractError('not an AmigaDOS hunk file');
  }
  while (next() !== 0) {
    // Resident library names: none expected, skip any.
  }
  next(); // table size
  const first = next();
  const last = next();
  const sizes = Array.from(
    { length: last - first + 1 },
    () => (next() & 0x3f_ff_ff_ff) * 4
  );

  const hunks: Hunk[] = [];
  while (offset < file.length) {
    const type = next() & 0x3f_ff_ff_ff;
    if (type === HUNK_CODE || type === HUNK_DATA) {
      const length = next() * 4;
      const size = sizes[hunks.length] ?? length;
      const data = new Uint8Array(size);
      data.set(file.subarray(offset, offset + length));
      offset += length;
      hunks.push({
        data,
        relocs: new Map(),
        size,
        type: type === HUNK_CODE ? 'code' : 'data'
      });
    } else if (type === HUNK_BSS) {
      next();
      const size = sizes[hunks.length] ?? 0;
      hunks.push({
        data: new Uint8Array(size),
        relocs: new Map(),
        size,
        type: 'bss'
      });
    } else if (type === HUNK_RELOC32) {
      const hunk = hunks.at(-1);
      if (!hunk) {
        throw new ExtractError('relocations before any hunk');
      }
      for (let count = next(); count !== 0; count = next()) {
        const target = next();
        const offsets = hunk.relocs.get(target) ?? [];
        for (let index = 0; index < count; index++) {
          offsets.push(next());
        }
        hunk.relocs.set(target, offsets);
      }
    } else if (type === HUNK_SYMBOL) {
      for (let longs = next(); longs !== 0; longs = next()) {
        offset += longs * 4 + 4;
      }
    } else if (type !== HUNK_END) {
      throw new ExtractError(`unsupported hunk type 0x${type.toString(16)}`);
    }
  }
  return hunks;
};

// Data hunk offsets of the starting-state tables
// (docs/re/starting-state-tables.md).
export const ROSTER_OFFSET = 0x1d_e8;
export const ROSTER_RECORD_SIZE = 38;
export const ROSTER_COUNT = 196;
export const ROUTE_OFFSET = 0x3b_00;
export const ROUTE_ROW_SIZE = 8;
export const ROUTE_COUNT = 86;
export const OBJECT_PLACEMENT_OFFSET = 0x3d_b0;
export const OBJECT_PLACEMENT_SIZE = 6;
export const OBJECT_PLACEMENT_COUNT = 30;
export const CLOCK_DAY_OFFSET = 0x3e_64;
export const CLOCK_QUARTER_HOUR_OFFSET = 0x3e_66;
export const EVENT_MASK_OFFSET = 0x3e_69;
export const RING_BEARER_OFFSET = 0x3e_6a;
export const PLACE_OFFSET = 0x3e_72;
export const PLACE_RECORD_SIZE = 10;
export const NAMED_PLACE_LAST = 69;
export const PLACE_KIND_LAST = 84;
export const OBJECT_OFFSET = 0x43_42;
export const OBJECT_RECORD_SIZE = 8;
export const OBJECT_COUNT = 17;
export const MONTH_START_OFFSET = 0x42_30;
export const MONTH_NAMES_OFFSET = 0x1d_66;
export const SPEED_TABLE_OFFSET = 0x41_c4;
export const TERRAIN_OFFSET = 0x42_42;
export const TERRAIN_COUNT = 256;
// The main loop moves roster entries 1 to 151
// (finding:time-clock-advances-after-each-roster-sweep); the rest wait in
// areas to be met in Encounters
// (finding:forces-encounter-figures-wait-in-areas).
export const TICKED_ROSTER_LAST = 151;
// An empty object placement slot.
const NO_OBJECT = 0x63;

// The calendar runs September to April
// (finding:time-calendar-september-to-april).
const MONTH_COUNT = 8;
const FIRST_YEAR = 1418;
const NEW_YEAR_DAY = 100;

export type Point = { x: number; y: number };

// Every condition but 'none' also needs its event bit set in the event
// mask (finding:ai-trigger-conditions).
export type Trigger =
  | { kind: 'none' }
  | { event_bit: 0; kind: 'near-ring-bearer' }
  | { event_bit: 2; kind: 'near-gandalf' }
  | { event_bit: number; kind: 'on-event' }
  | { days_after: number; event_bit: number; kind: 'after-event' };

export type Area = { bottom: number; left: number; right: number; top: number };

export type RosterEntry = {
  allegiance: number;
  destination: Point | null;
  // Entries after 151 only: where and how often they are met.
  encounter: { area: Area; chance: number; earliest_day: number } | null;
  facing: number;
  fighting: number;
  figure: number;
  // The pixel-fraction byte (256ths; finding:movement-speed-classes).
  // Null after entry 151, where the byte is the Encounter's first day.
  fraction: number | null;
  health: number;
  icon: number;
  index: number;
  is_unit: boolean;
  leader: number | null;
  max_health: number;
  max_stamina: number;
  name: string;
  objects: number[];
  position: Point | null;
  route: number;
  speed: number;
  stamina: number;
  starting_strength: number;
  state: number;
  strength: number;
  ticked: boolean;
  trigger: Trigger;
  trigger_byte: number;
  // Raw values whose meaning is not settled; see the roster record layout.
  unknown: { b19: number; b24: number; b29: number | null };
};

export type Place = {
  announces_attacks: boolean;
  grid_byte: number;
  // Null for Green Hills and the Rammas forts, which have no grid byte and
  // are never asked about.
  grid_reference: string | null;
  index: number;
  name: string;
  position: Point;
  tile: Point;
  // The generic kind whose map tile lies under the Place, if any. The game
  // matches named Places by position first, so this is an inference.
  tile_kind: string | null;
};

export type PlaceKind = { index: number; name: string; tile: number };

export type Force = {
  leader: number;
  // The leader first, then each follower in roster order.
  members: number[];
  // Only Forces whose leader is awake are drawn on the Campaign Level.
  on_map: boolean;
  position: Point;
  state: number;
};

export type GameObject = {
  bytes: number[];
  index: number;
  name: string;
};

export type StartingState = {
  calendar: {
    months: { first_day: number; name: string }[];
    new_year_day: number;
    years: number[];
  };
  clock: {
    date: string;
    day: number;
    display_hour: string;
    quarter_hour: number;
  };
  events: { event_days: number[]; mask: number; ring_bearer: number };
  forces: Force[];
  object_placements: { object: number; position: Point }[];
  objects: GameObject[];
  place_kinds: PlaceKind[];
  places: Place[];
  roster: RosterEntry[];
  routes: { index: number; places: number[] }[];
  source: { file: string; member: string };
  speeds: { diagonal: number[]; straight: number[] };
  // One terrain percentage per map tile number
  // (finding:movement-terrain-percent-scales-pace).
  terrain_by_tile: number[];
};

const cString = (data: Uint8Array, offset: number): string => {
  let end = offset;
  while (end < data.length && data[end] !== 0) {
    end++;
  }
  return String.fromCharCode(...data.subarray(offset, end));
};

const point = (x: number, y: number): Point | null =>
  x === 0 && y === 0 ? null : { x, y };

// The highest set bit of the trigger byte picks the condition
// (finding:ai-trigger-conditions).
export const decodeTrigger = (value: number): Trigger => {
  if (value === 0) {
    return { kind: 'none' };
  }
  const bit = 31 - Math.clz32(value);
  if (bit === 0) {
    return { event_bit: 0, kind: 'near-ring-bearer' };
  }
  if (bit === 2) {
    return { event_bit: 2, kind: 'near-gandalf' };
  }
  if (bit <= 3) {
    return { event_bit: bit, kind: 'on-event' };
  }
  return { days_after: value & 0xf, event_bit: bit, kind: 'after-event' };
};

// Place grid references are checked against the box map
// (finding:places-grid-reference-byte).
export const gridReference = (value: number): string =>
  `${String.fromCharCode(0x41 + ((value >> 1) & 7))}${value >> 4}`;

const formatHour = (quarterHour: number): string => {
  const hour = quarterHour >> 2;
  const shown = hour > 11 ? hour - 11 : hour + 1;
  return `${shown} ${hour > 10 && hour < 23 ? 'p.m.' : 'a.m.'}`;
};

export const readStartingState = (
  executable: Uint8Array,
  mapIndices?: Uint8Array
): StartingState => {
  const hunks = parseHunkFile(executable);
  const code = hunks.find(hunk => hunk.type === 'code');
  const data = hunks.find(hunk => hunk.type === 'data');
  if (!code || !data) {
    throw new ExtractError('executable has no code or data hunk');
  }
  const bytes = data.data;
  const u8 = (offset: number) => bytes[offset]!;
  const u16 = (offset: number) => beU16(bytes, offset);
  // Strings are in the code hunk, which the data hunk points into.
  const codeString = (offset: number) => cString(code.data, u32(offset));
  const u32 = (offset: number) => beU32(bytes, offset);

  const roster: RosterEntry[] = [];
  for (let index = 0; index < ROSTER_COUNT; index++) {
    const base = ROSTER_OFFSET + index * ROSTER_RECORD_SIZE;
    const objectMask = u16(base + 16);
    const leader = u8(base + 35);
    const ticked = index >= 1 && index <= TICKED_ROSTER_LAST;
    const waits = index > TICKED_ROSTER_LAST;
    roster.push({
      allegiance: u8(base + 28),
      destination: waits ? null : point(u16(base + 12), u16(base + 14)),
      encounter: waits
        ? {
            area: {
              bottom: u16(base + 14),
              left: u16(base + 8),
              right: u16(base + 12),
              top: u16(base + 10)
            },
            chance: u8(base + 29),
            earliest_day: u8(base + 32)
          }
        : null,
      facing: u8(base + 21),
      fighting: u8(base + 23),
      figure: u8(base + 20),
      fraction: waits ? null : u8(base + 32),
      health: u16(base + 26),
      icon: u8(base + 18),
      index,
      is_unit: u16(base + 4) > 1,
      leader: leader === 0 ? null : leader,
      max_health: u8(base + 25),
      max_stamina: u8(base + 33),
      name: index === 0 ? '' : codeString(base),
      objects: Array.from({ length: 16 }, (_, bit) => bit).filter(
        bit => (objectMask >> bit) & 1
      ),
      position: waits ? null : point(u16(base + 8), u16(base + 10)),
      route: u8(base + 36),
      speed: u8(base + 31),
      stamina: u8(base + 34),
      starting_strength: u16(base + 4),
      state: u8(base + 22),
      strength: u16(base + 6),
      ticked,
      trigger: decodeTrigger(u8(base + 30)),
      trigger_byte: u8(base + 30),
      unknown: {
        b19: u8(base + 19),
        b24: u8(base + 24),
        b29: waits ? null : u8(base + 29)
      }
    });
  }

  const placeKinds: PlaceKind[] = [];
  for (let index = NAMED_PLACE_LAST + 1; index <= PLACE_KIND_LAST; index++) {
    const base = PLACE_OFFSET + index * PLACE_RECORD_SIZE;
    placeKinds.push({ index, name: codeString(base), tile: u16(base + 6) });
  }
  const kindByTile = new Map(placeKinds.map(kind => [kind.tile, kind.name]));

  const places: Place[] = [];
  for (let index = 1; index <= NAMED_PLACE_LAST; index++) {
    const base = PLACE_OFFSET + index * PLACE_RECORD_SIZE;
    const position = { x: u16(base + 4), y: u16(base + 6) };
    const tile = { x: position.x >> 4, y: position.y >> 4 };
    const gridByte = u8(base + 8);
    const tileNumber = mapIndices?.[tile.y * 160 + tile.x];
    places.push({
      announces_attacks: (gridByte & 1) === 1,
      grid_byte: gridByte,
      grid_reference: gridByte === 0 ? null : gridReference(gridByte),
      index,
      name: codeString(base),
      position,
      tile,
      tile_kind:
        tileNumber === undefined ? null : (kindByTile.get(tileNumber) ?? null)
    });
  }

  const routes = Array.from({ length: ROUTE_COUNT }, (_, index) => {
    const base = ROUTE_OFFSET + index * ROUTE_ROW_SIZE;
    const row = [...bytes.subarray(base, base + ROUTE_ROW_SIZE)];
    const end = row.indexOf(0);
    return { index, places: end === -1 ? row : row.slice(0, end) };
  });

  const objects: GameObject[] = Array.from(
    { length: OBJECT_COUNT },
    (_, index) => {
      const base = OBJECT_OFFSET + index * OBJECT_RECORD_SIZE;
      return {
        bytes: [...bytes.subarray(base + 4, base + OBJECT_RECORD_SIZE)],
        index,
        name: codeString(base)
      };
    }
  );

  const objectPlacements: StartingState['object_placements'] = [];
  for (let index = 0; index < OBJECT_PLACEMENT_COUNT; index++) {
    const base = OBJECT_PLACEMENT_OFFSET + index * OBJECT_PLACEMENT_SIZE;
    if (u8(base) !== NO_OBJECT) {
      objectPlacements.push({
        object: u8(base),
        position: { x: u16(base + 2), y: u16(base + 4) }
      });
    }
  }

  // A Force is a leader with no leader of its own and everyone whose chain
  // of leaders ends at it (finding:forces-leader-byte-forms-forces).
  const topLeader = (entry: RosterEntry): number => {
    const seen = new Set<number>();
    let current = entry;
    while (current.leader !== null) {
      if (seen.has(current.index)) {
        throw new ExtractError(`leader loop at roster entry ${entry.index}`);
      }
      seen.add(current.index);
      current = roster[current.leader]!;
    }
    return current.index;
  };
  const forces: Force[] = [];
  const byLeader = new Map<number, Force>();
  for (const entry of roster.slice(1)) {
    const leaderIndex = topLeader(entry);
    const leader = roster[leaderIndex]!;
    let force = byLeader.get(leaderIndex);
    if (!force) {
      if (!leader.position) {
        // Not on the map at the start: no position of its own.
        continue;
      }
      force = {
        leader: leaderIndex,
        members: [leaderIndex],
        on_map: leader.state !== 0,
        position: leader.position,
        state: leader.state
      };
      byLeader.set(leaderIndex, force);
      forces.push(force);
    }
    if (entry.index !== leaderIndex) {
      force.members.push(entry.index);
    }
  }
  forces.sort((a, b) => a.leader - b.leader);

  const monthStarts = Array.from({ length: MONTH_COUNT }, (_, month) => {
    const value = u16(MONTH_START_OFFSET + month * 2);
    return value >= 0x80_00 ? value - 0x01_00_00 : value;
  });
  const months = monthStarts.map((firstDay, month) => ({
    first_day: firstDay,
    name: codeString(MONTH_NAMES_OFFSET + month * 4).trim()
  }));
  const day = u16(CLOCK_DAY_OFFSET);
  const quarterHour = u16(CLOCK_QUARTER_HOUR_OFFSET);
  const month = monthStarts.findLastIndex(first => first <= day);
  const date = `${day + 1 - monthStarts[month]!} ${months[month]!.name} ${
    day >= NEW_YEAR_DAY ? FIRST_YEAR + 1 : FIRST_YEAR
  } S.R.`;

  return {
    calendar: {
      months,
      new_year_day: NEW_YEAR_DAY,
      years: [FIRST_YEAR, FIRST_YEAR + 1]
    },
    clock: {
      date,
      day,
      display_hour: formatHour(quarterHour),
      quarter_hour: quarterHour
    },
    events: {
      event_days: [...bytes.subarray(RING_BEARER_OFFSET, PLACE_OFFSET)].slice(
        1
      ),
      mask: u8(EVENT_MASK_OFFSET),
      ring_bearer: u8(RING_BEARER_OFFSET)
    },
    forces,
    object_placements: objectPlacements,
    objects,
    place_kinds: placeKinds,
    places,
    roster,
    routes,
    source: { file: EXECUTABLE_FILE, member: EXECUTABLE_MEMBER },
    speeds: {
      diagonal: Array.from({ length: 6 }, (_, speed) =>
        u16(SPEED_TABLE_OFFSET + 12 + speed * 2)
      ),
      straight: Array.from({ length: 6 }, (_, speed) =>
        u16(SPEED_TABLE_OFFSET + speed * 2)
      )
    },
    terrain_by_tile: [
      ...bytes.subarray(TERRAIN_OFFSET, TERRAIN_OFFSET + TERRAIN_COUNT)
    ]
  };
};

export const loadExecutable = (archive: string): Uint8Array =>
  new AmigaOFSImage(loadLhaMember(archive, EXECUTABLE_MEMBER)).readFile(
    EXECUTABLE_FILE
  );

const fillRect = (
  image: RgbaImage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
): void => {
  for (
    let row = Math.max(0, y);
    row < Math.min(image.height, y + height);
    row++
  ) {
    for (
      let column = Math.max(0, x);
      column < Math.min(image.width, x + width);
      column++
    ) {
      const offset = (row * image.width + column) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
};

const outlineRect = (
  image: RgbaImage,
  x: number,
  y: number,
  size: number,
  color: [number, number, number]
): void => {
  fillRect(image, x, y, size, 1, color);
  fillRect(image, x, y + size - 1, size, 1, color);
  fillRect(image, x, y, 1, size, color);
  fillRect(image, x + size - 1, y, 1, size, color);
};

// Draw each Place's tile in white, labelled with its Place index, and each
// Force's tile in blue (Good, the player's), green (not mobilised) or red
// (Evil), labelled with its leader's roster index, over the Campaign Level
// map. The sheet font only has digits.
export const renderOverlay = (
  state: StartingState,
  assets: CampaignMapAssets
): RgbaImage => {
  const image = renderRawMap(
    assets.tiles,
    assets.mapIndices,
    assets.palette,
    160,
    99,
    160
  ).toRgba();
  for (const place of state.places) {
    outlineRect(image, place.position.x, place.position.y, 16, [255, 255, 255]);
    drawSheetLabel(
      image,
      place.position.x + 1,
      place.position.y - 9,
      String(place.index),
      [255, 255, 255]
    );
  }
  for (const force of state.forces) {
    const leader = state.roster[force.leader]!;
    const color: [number, number, number] =
      leader.allegiance === 0
        ? [255, 64, 64]
        : leader.allegiance === 1
          ? [64, 255, 64]
          : [96, 160, 255];
    outlineRect(image, force.position.x + 2, force.position.y + 2, 12, color);
    drawSheetLabel(
      image,
      force.position.x + 2,
      force.position.y + 16,
      String(force.leader),
      color
    );
  }
  return image;
};

export const writeStartingState = (path: string, state: StartingState) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifySortedJson(state), 'utf8');
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      out: { default: 'web/public/assets', type: 'string' },
      overlay: { type: 'string' }
    }
  });
  const archive = positionals[0] ?? DEFAULT_ARCHIVE;
  const out = values.out ?? 'web/public/assets';
  const assets = loadCampaignMapAssets(archive);
  const state = readStartingState(loadExecutable(archive), assets.mapIndices);
  const path = join(out, STARTING_STATE_FILE);
  writeStartingState(path, state);
  if (values.overlay) {
    mkdirSync(dirname(values.overlay), { recursive: true });
    writeRgbaPng(values.overlay, renderOverlay(state, assets));
  }
  console.log(
    `read ${state.roster.length - 1} roster entries, ${state.places.length} Places and ` +
      `${state.forces.length} Forces; wrote ${path}` +
      (values.overlay ? ` and ${values.overlay}` : '')
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
