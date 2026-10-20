// How an Animation Level scene is composed (docs/spec/animation-level.md,
// finding:graphics-animation-level-scene-layers), following the
// original's builder at code+0x00006. The scenery is a list of strips
// chosen from the tables of the original's data hunk with the original's
// random numbers, seeded from the watched Character's tile, so a tile
// shows the same scenery each time. Only the sky's clouds use free
// random numbers. The sim never sees any of this.

export interface SceneryGroup {
  choices: number[];
  optional: boolean;
  parallax: number;
}

// The data hunk's scene tables, as exported to animation/tables.json.
export interface AnimationTables {
  figure_scripts: number[][];
  foreground_lists: number[][];
  foreground_offsets: number[];
  scene_words: number[];
  scenery_lists: SceneryGroup[][];
  sky_colours: number[];
  sky_colours_dark: number[];
}

export interface SceneTilemap {
  indices: number[];
  width: number;
}

// The original's generator (code+0x0320c): each call steps the seed
// and returns it modulo n, 0 to n - 1.
export const originalRandom = (
  seed: number
): { next: (n: number) => number; seed: () => number } => {
  let state = seed >>> 0;
  return {
    next: n => {
      state = Number((BigInt(state) * 125n) % 0x2a_aa_abn);
      return n > 0 ? state % n : 0;
    },
    seed: () => state
  };
};

const tileAt = (tilemap: SceneTilemap, x: number, y: number): number =>
  tilemap.indices[Math.floor(y / 16) * tilemap.width + Math.floor(x / 16)] ?? 0;

// The south-east of the map, from (0x690, 0x3e0), where the scenery
// lists are remapped and the sky is darker (code+0x004bc).
const SOUTH_EAST = { x: 0x6_90, y: 0x3_e0 };
// Remapped scenery list by list index there (jump table at code+0x00530).
const SOUTH_EAST_LISTS = [
  0, 4, 15, 4, 4, 6, 6, 7, 8, 9, 4, 11, 15, 4, 6, 15, 16, 6
];
// Around Mount Doom the list is always 16 (code+0x004e8).
const MOUNT_DOOM = { x0: 0x7_00, x1: 0x7_30, y0: 0x4_50, y1: 0x4_80 };

export interface SceneStep {
  // In the south-east: a darker sky, and no clouds.
  dark: boolean;
  // How far into its tile the Character is, 0 to 30 in steps of 2.
  sub: number;
  // The tile byte under the Character.
  tile: number;
  // The scene word of the tile (data+0x0258).
  word: number;
}

// Where the watched Character stands, as the scene sees it (code+0x00396).
export const sceneStep = (
  tilemap: SceneTilemap,
  words: number[],
  position: { x: number; y: number },
  facing: number
): SceneStep => {
  const { x, y } = position;
  let along = (x & 15) === 0 ? y & 15 : x & 15;
  if (((facing + 7) & 7) > 3 && along !== 0) {
    along = 16 - along;
  }
  const tile = tileAt(tilemap, x + 8, y + 8);
  let word = words[tile] ?? 0;
  const dark = x >= SOUTH_EAST.x && y >= SOUTH_EAST.y;
  if (dark) {
    const list =
      x >= MOUNT_DOOM.x0 &&
      x < MOUNT_DOOM.x1 &&
      y >= MOUNT_DOOM.y0 &&
      y < MOUNT_DOOM.y1
        ? 16
        : (SOUTH_EAST_LISTS[word & 0x1f] ?? word & 0x1f);
    word = (word & 0xff_e0) | list;
  }
  return { dark, sub: along * 2, tile, word };
};

// One strip of scenery, by IMAG id, top left at (x, y).
export interface SceneStrip {
  id: number;
  mirrored: boolean;
  x: number;
  y: number;
}

// The ground line foreground pieces stand on, unless a set piece moves
// it (code+0x005e8). Foreground rows run from it to FOREGROUND_BOTTOM.
const GROUND_LINE = 0x80;
const FOREGROUND_BOTTOM = 0xa2;
const FIRST_FOREGROUND_IMAG = 300;
// Strips with bit 15 set are drawn twice, 320 apart, so they span the
// screen however far they are shifted (code+0x00322).
const WIDE = 0x80_00;

const stripY = (choice: number, random: (n: number) => number): number => {
  const y = (choice & 0x3f_80) >> 7;
  // `btst #6` on the word's high byte: bit 14 fixes the height.
  return choice & 0x40_00 ? y : random(y);
};

// A wide strip at a random x shifted for parallax, kept within one
// screen width to the left (code+0x00836).
const wideX = (
  random: (n: number) => number,
  parallax: number,
  sub: number
) => {
  let x = random(320) - 320 - parallax * sub;
  while (x < -320) {
    x += 320;
  }
  return x;
};

// The set pieces of bits 5 to 7 of the scene word: the strip, the ground
// line it leaves and its parallax (code+0x006ac). On a tile origin the
// first three stand alone, with no foreground.
const SET_PIECES: Record<
  number,
  { ground: number; id: number; parallax: number }
> = {
  0x80: { ground: 0x82, id: 0xe8_91, parallax: 0x28 },
  0xc0: { ground: 0x8c, id: 0xdd_12, parallax: 0x28 },
  0x20: { ground: 0, id: 0x5a_28, parallax: 0 },
  0x40: { ground: 0, id: 0x5c_27, parallax: 0 },
  0x60: { ground: 0, id: 0x5a_26, parallax: 0 }
};
// Off a tile origin every set piece but 0xc0 shows as 0x80's.
const SET_PIECE_MOVING = SET_PIECES[0x80]!;

// The per-Place scenery of bits 10 to 15 (code+0x00d3c). It draws from
// the original's random numbers and edits the strips so far in place:
// some Places replace the last strip, two start the list afresh. It
// returns the new ground line, if any, and whether one more strip from
// data+0x08a2 follows.
export type SpecialScenery = (
  tile: number,
  random: (n: number) => number,
  strips: SceneStrip[]
) => { extra: boolean; ground?: number };

// The strips the extra piece is drawn from (data+0x08a2).
const EXTRA_PIECES = [0xdb_20, 0xdf_a1, 0xd6_a2, 0xdc_ab, 0xdf_aa];

// The strips of a scene in drawing order (code+0x0058e): the scenery
// groups of the tile's list, the per-Place scenery, the set pieces, then
// the foreground.
export const layoutScene = (
  tables: AnimationTables,
  step: SceneStep,
  position: { x: number; y: number },
  special?: SpecialScenery
): SceneStrip[] => {
  const tileSeed =
    (Math.floor(position.y / 16) << 16) | Math.floor(position.x / 16);
  const random = originalRandom(tileSeed).next;
  const strips: SceneStrip[] = [];
  const push = (choice: number, x: number, y: number, mirrored: boolean) =>
    strips.push({ id: signed(choice & 0xff_ff), mirrored, x, y });
  for (const group of tables.scenery_lists[step.word & 0x1f] ?? []) {
    if (group.optional && random(3) !== 0) {
      continue;
    }
    const choice = (group.choices[random(group.choices.length)] ?? 0) & 0xff_ff;
    let x =
      choice & WIDE
        ? wideX(random, group.parallax, step.sub)
        : random(320) - group.parallax * step.sub;
    let y = stripY(choice, random);
    // Two strips are placed specially when drawn (code+0x002c2).
    if (choice === 0x45_23) {
      x = 0;
    } else if (choice === 0xd2_07) {
      y += 10;
    }
    push(choice, x, y, random(2) !== 0);
  }
  let ground = GROUND_LINE;
  if (special && step.word & 0xfc_00 && step.sub === 0) {
    const place = special(step.tile, random, strips);
    {
      ground = place.ground ?? ground;
      if (place.extra) {
        const choice = EXTRA_PIECES[random(5)]!;
        push(choice, -160, (choice & 0x3f_80) >> 7, random(2) !== 0);
      }
    }
  }
  const setPiece = step.word & 0xe0;
  const piece =
    step.sub === 0 || setPiece === 0xc0
      ? SET_PIECES[setPiece]
      : SET_PIECES[setPiece] && SET_PIECE_MOVING;
  if (piece) {
    ground = piece.ground;
    const x = step.sub === 0 ? 0 : wideX(random, piece.parallax, step.sub);
    push(piece.id, x, (piece.id & 0x3f_80) >> 7, random(2) !== 0);
  }
  // Bits 8 and 9 add a river in front (code+0x008e0).
  if (step.word & 0x3_00) {
    push(
      0x56_29,
      0,
      ((0x56_29 & 0x7f_80) >> 7) - 10,
      ((step.sub >> 1) & 1) === 1
    );
  }
  if (step.sub === 0 && step.tile === 0x8d) {
    push(0xd7, 0, 0, false);
  }
  if (ground === 0) {
    return strips;
  }
  // The foreground is reseeded from the tile and sub-position
  // (code+0x00a12) and scattered in rows from the ground line down.
  const foreground = originalRandom(
    ((step.sub >> 1) << 16) |
      (Math.floor(position.y / 16) << 8) |
      Math.floor(position.x / 16)
  ).next;
  const list = tables.foreground_lists[step.word & 0x1f] ?? [];
  const rowStep = Math.max(1, Math.trunc((0xa0 - ground) / 3));
  for (
    let row = ground;
    list.length > 0 && row < FOREGROUND_BOTTOM;
    row += rowStep
  ) {
    const id = list[foreground(list.length)] ?? FIRST_FOREGROUND_IMAG;
    let x = foreground(300) - 10;
    if (step.tile === 0x6d) {
      x += 40;
    }
    const y =
      row - (tables.foreground_offsets[id - FIRST_FOREGROUND_IMAG] ?? 0);
    // IMAG 305 to 308 are never mirrored.
    const mirrorable = id < 0x1_31 || id > 0x1_34;
    const mirrored = mirrorable && (foreground(100) & 1) === 1;
    strips.push({ id, mirrored, x, y });
  }
  return strips;
};

const signed = (word: number): number =>
  word & WIDE ? word - 0x1_00_00 : word;

// Whether a strip is drawn a second time, 320 to the right.
export const isWide = (id: number): boolean => id < 0 && id !== signed(0xc0_30);

// The sky's palette index for the quarter-hour (code+0x00090,
// finding:graphics-animation-level-sky-by-hour).
export const skyColour = (
  tables: AnimationTables,
  quarterHour: number,
  dark: boolean
): number =>
  (dark
    ? tables.sky_colours_dark[quarterHour >> 4]
    : tables.sky_colours[quarterHour >> 3]) ?? 0;

export interface Cloud {
  id: number;
  mirrored: boolean;
  x: number;
  y: number;
}

// From 4 a.m. to 8 p.m., three tries at three in four each to add one of
// AScene.res IMAG 1283 to 1285 (code+0x000ea).
export const placeClouds = (
  quarterHour: number,
  dark: boolean,
  random: (n: number) => number
): Cloud[] => {
  if (quarterHour <= 15 || quarterHour >= 80 || dark) {
    return [];
  }
  const clouds: Cloud[] = [];
  for (let i = 0; i < 3; i++) {
    if (random(4) === 0) {
      continue;
    }
    const id = 0x5_03 + random(3);
    const x = random(0x1_4a) - 10;
    const y = random(15);
    clouds.push({ id, mirrored: random(2) !== 0, x, y });
  }
  return clouds;
};
