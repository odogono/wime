// Export what the view needs to draw the Animation Level
// (docs/spec/animation-level.md): its palette, figure sets, icons, window
// frame and the scene tables of the executable's data hunk.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AmigaOFSImage,
  ExtractError,
  IndexedImage,
  RESOURCE_FILES,
  beS16,
  beU16,
  beU32,
  decodeFrmlResource,
  decodeImagResource,
  loadLhaMember,
  parseResourceFork,
  stringifySortedJson
} from './extract-graphics';
import {
  ROSTER_COUNT,
  ROSTER_OFFSET,
  ROSTER_RECORD_SIZE,
  parseHunkFile
} from './extract-starting-state';
import { paletteFromRgb4Words } from './render-campaign-map';

// Data hunk offsets, from docs/re/labels.md and the Findings cited.
// finding:graphics-animation-level-palette
export const ANIMATION_PALETTE_OFFSET = 0x4b_48;
// finding:graphics-animation-level-scene-layers
const SCENE_WORDS_OFFSET = 0x02_58;
const SCENERY_LISTS_OFFSET = 0x06_b0;
const FOREGROUND_OFFSETS_OFFSET = 0x06_f8;
const FOREGROUND_LISTS_OFFSET = 0x08_5a;
export const SCENERY_LIST_COUNT = 18;
// BScene.res IMAG 300 to 317.
export const FOREGROUND_FIRST_IMAG = 300;
const FOREGROUND_IMAG_COUNT = 18;
// finding:graphics-animation-level-sky-by-hour
const SKY_COLOURS_OFFSET = 0x08_ac;
const DARK_SKY_COLOURS_OFFSET = 0x08_b8;
// finding:graphics-figure-animation-scripts
const FIGURE_SCRIPTS_OFFSET = 0x09_5e;
export const FIGURE_SCRIPT_LENGTH = 0xfc;
export const FIGURE_SET_COUNT = 20;

// finding:ui-animation-level-icons
export const ANIMATION_ICONS = [
  { button: 0xf0, imag: 21, name: 'eye', x: 300, y: 10 },
  { button: 0xf6, imag: 23, name: 'map', x: 300, y: 25 },
  { button: 0xf9, imag: 25, name: 'sack', x: 300, y: 42 }
];
// finding:ui-window-frame-tiles: the Animation Level's frame sheet.
const WINDOW_FRAME_IMAG = 12;
// finding:graphics-figure-colour-selectors: the unchanged four-plane preview.
const FOUR_PLANE_COLOUR_BASE = 16;
// finding:graphics-figure-colour-selectors
const FIGURE_COLOUR_WORDS_OFFSET = 0x4b_c8;
const FIGURE_COLOUR_COUNT = 32;
const ENDING_FIGURE_SETS_OFFSET = 0x09_3a;
const ENDING_FIGURE_COLOURS_OFFSET = 0x09_55;
const ENDING_FIGURE_COUNT = 9;

// One group of a scenery list: one strip is drawn from `choices`.
export type SceneryGroup = {
  // Each id word is also its placement: see
  // finding:graphics-animation-level-scene-layers.
  choices: number[];
  optional: boolean;
  parallax: number;
};

export type AnimationTables = {
  figure_colours: number[];
  figure_scripts: number[][];
  foreground_lists: number[][];
  // y above the ground line of BScene.res IMAG 300 + i.
  foreground_offsets: number[];
  scene_words: number[];
  scenery_lists: SceneryGroup[][];
  sky_colours: number[];
  sky_colours_dark: number[];
};

const dataHunk = (executable: Uint8Array): Uint8Array => {
  const data = parseHunkFile(executable).find(hunk => hunk.type === 'data');
  if (!data) {
    throw new ExtractError('executable has no data hunk');
  }
  return data.data;
};

export const readAnimationPalette = (executable: Uint8Array): number[] =>
  paletteFromRgb4Words(
    dataHunk(executable).subarray(
      ANIMATION_PALETTE_OFFSET,
      ANIMATION_PALETTE_OFFSET + 64
    ),
    32
  );

const words = (data: Uint8Array, offset: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => beU16(data, offset + i * 2));

// The scenery lists are pointers into the data hunk, each to a null-ended
// list of pointers to groups. A group is a header word, bit 15 optional,
// bits 14 to 8 the parallax factor and the low byte the number of id
// words that follow (code+0x0058e).
const readSceneryLists = (data: Uint8Array): SceneryGroup[][] =>
  Array.from({ length: SCENERY_LIST_COUNT }, (_, k) => {
    const groups: SceneryGroup[] = [];
    let pointer = beU32(data, SCENERY_LISTS_OFFSET + k * 4);
    for (let group = beU32(data, pointer); group !== 0;) {
      const header = beU16(data, group);
      groups.push({
        choices: Array.from({ length: header & 0xff }, (_, i) =>
          beS16(data, group + 2 + i * 2)
        ),
        optional: (header & 0x80_00) !== 0,
        parallax: (header >> 8) & 0x7f
      });
      pointer += 4;
      group = beU32(data, pointer);
    }
    return groups;
  });

// Each foreground list is a count word and that many IMAG ids.
const readForegroundLists = (data: Uint8Array): number[][] =>
  Array.from({ length: SCENERY_LIST_COUNT }, (_, k) => {
    const list = beU32(data, FOREGROUND_LISTS_OFFSET + k * 4);
    return words(data, list + 2, beU16(data, list));
  });

export const readAnimationTables = (
  executable: Uint8Array
): AnimationTables => {
  const data = dataHunk(executable);
  return {
    figure_colours: Array.from(
      { length: ROSTER_COUNT },
      (_, i) => data[ROSTER_OFFSET + i * ROSTER_RECORD_SIZE + 19]!
    ),
    figure_scripts: Array.from({ length: FIGURE_SET_COUNT }, (_, id) => [
      ...data.subarray(
        FIGURE_SCRIPTS_OFFSET + id * FIGURE_SCRIPT_LENGTH,
        FIGURE_SCRIPTS_OFFSET + (id + 1) * FIGURE_SCRIPT_LENGTH
      )
    ]),
    foreground_lists: readForegroundLists(data),
    foreground_offsets: words(
      data,
      FOREGROUND_OFFSETS_OFFSET,
      FOREGROUND_IMAG_COUNT
    ),
    scene_words: words(data, SCENE_WORDS_OFFSET, 256),
    scenery_lists: readSceneryLists(data),
    sky_colours: [
      ...data.subarray(SKY_COLOURS_OFFSET, SKY_COLOURS_OFFSET + 12)
    ],
    sky_colours_dark: [
      ...data.subarray(DARK_SKY_COLOURS_OFFSET, DARK_SKY_COLOURS_OFFSET + 6)
    ]
  };
};

export type FigureFrame = {
  height: number;
  hot_x: number;
  hot_y: number;
  width: number;
  x: number;
};

export type FigureSet = {
  colour_rows: Record<number, number>;
  depth: number;
  frames: FigureFrame[];
  height: number;
  id: number;
  path: string;
  resource_file: string;
  width: number;
};

// Route the four source planes into five screen planes. Fields 4 and 5
// clear/fill a plane; source zero is outside the mask
// (finding:graphics-figure-colour-selectors).
export const figureColour = (index: number, word: number): number => {
  if ((index & 15) === 0) {
    return 0;
  }
  let colour = 0;
  for (let plane = 0; plane < 5; plane++) {
    const source = (word >> (plane * 3)) & 7;
    const bit = source === 5 ? 1 : source === 4 ? 0 : (index >> source) & 1;
    colour |= bit << plane;
  }
  return colour;
};

// A figure set's frames side by side in one sheet, colour 0 clear. The
// first row is the unchanged preview (4-plane sets in colours 16 to
// 31); the used colour variants follow, each one sheet-height lower.
export const buildFigureSheet = (
  frames: { hotX: number; hotY: number; image: IndexedImage }[],
  depth: number,
  palette: number[],
  colourWords: Map<number, number> = new Map()
): {
  colour_rows: Record<number, number>;
  frames: FigureFrame[];
  sheet: IndexedImage;
} => {
  const width = Math.max(
    1,
    frames.reduce((total, frame) => total + frame.image.width, 0)
  );
  const height = Math.max(1, ...frames.map(frame => frame.image.height));
  const sheet = new IndexedImage(
    width,
    height * (colourWords.size + 1),
    palette
  );
  const colour_rows: Record<number, number> = { 0: 0 };
  let rowOffset = height;
  for (const selector of colourWords.keys()) {
    colour_rows[selector] = rowOffset;
    rowOffset += height;
  }
  const base = depth === 4 ? FOUR_PLANE_COLOUR_BASE : 0;
  const placed: FigureFrame[] = [];
  let x = 0;
  for (const { hotX, hotY, image } of frames) {
    for (let row = 0; row < image.height; row++) {
      for (let column = 0; column < image.width; column++) {
        const value = image.getPixel(column, row);
        sheet.setPixel(x + column, row, value === 0 ? 0 : value + base);
        for (const [selector, word] of colourWords) {
          sheet.setPixel(
            x + column,
            row + colour_rows[selector]!,
            figureColour(value, word)
          );
        }
      }
    }
    placed.push({
      height: image.height,
      hot_x: hotX,
      hot_y: hotY,
      width: image.width,
      x
    });
    x += image.width;
  }
  return { colour_rows, frames: placed, sheet };
};

// Save with colour 0 clear, so figures, icons and frames lie over the scene.
const saveClear = (image: IndexedImage, path: string): void => {
  mkdirSync(join(path, '..'), { recursive: true });
  image.saveWithClearColour(path, 0);
};

export type AnimationFile = {
  height: number | null;
  imag?: number;
  path: string;
  width: number | null;
};

export type AnimationExport = {
  figures: FigureSet[];
  files: AnimationFile[];
  tables: AnimationTables;
};

export const exportAnimationLevel = (
  archive: string,
  executable: Uint8Array,
  outputDir: string
): AnimationExport => {
  const dir = join(outputDir, 'animation');
  mkdirSync(dir, { recursive: true });
  const palette = readAnimationPalette(executable);
  const files: AnimationFile[] = [];
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(dir, name), stringifySortedJson(value), 'utf8');
    files.push({ height: null, path: `animation/${name}`, width: null });
  };

  const colours = Array.from({ length: 32 }, (_, i) =>
    palette.slice(i * 3, i * 3 + 3)
  );
  write('palette.json', {
    colors: colours,
    hex: colours.map(
      rgb => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`
    ),
    palette_source:
      'Animation Level RGB4 words at data+0x4b48 in the executable (finding:graphics-animation-level-palette)'
  });

  const tables = readAnimationTables(executable);
  write('tables.json', tables);

  const data = dataHunk(executable);
  const colourWords = words(
    data,
    FIGURE_COLOUR_WORDS_OFFSET,
    FIGURE_COLOUR_COUNT
  );
  // All selectors the Reference Build uses for each set, plus the ending
  // pictures (finding:graphics-figure-colour-selectors).
  const selectors = new Map<number, Set<number>>();
  const addColour = (frml: number, colour: number): void => {
    if (colour !== 0) {
      const used = selectors.get(frml) ?? new Set<number>();
      used.add(colour);
      selectors.set(frml, used);
    }
  };
  for (let i = 0; i < ROSTER_COUNT; i++) {
    addColour(
      data[ROSTER_OFFSET + i * ROSTER_RECORD_SIZE + 20]!,
      tables.figure_colours[i]!
    );
  }
  for (let i = 0; i < ENDING_FIGURE_COUNT; i++) {
    addColour(
      data[ENDING_FIGURE_SETS_OFFSET + i]!,
      data[ENDING_FIGURE_COLOURS_OFFSET + i]!
    );
  }
  addColour(8, 1);

  const figures: FigureSet[] = [];
  for (const [, [memberName, resourceNames]] of Object.entries(
    RESOURCE_FILES
  )) {
    const disk = new AmigaOFSImage(loadLhaMember(archive, memberName));
    for (const resourceName of resourceNames) {
      const fork = parseResourceFork(disk.readFile(resourceName));
      for (const resource of fork.byType('FRML')) {
        const decoded = decodeFrmlResource(resource.data, resource.attributes);
        const { colour_rows, frames, sheet } = buildFigureSheet(
          decoded.frames,
          decoded.depth,
          palette,
          new Map(
            [...(selectors.get(resource.resourceId) ?? [])]
              .sort((a, b) => a - b)
              .map(selector => [selector, colourWords[selector]!])
          )
        );
        const path = `figures/FRML_${resource.resourceId}.png`;
        saveClear(sheet, join(dir, path));
        files.push({
          height: sheet.height,
          path: `animation/${path}`,
          width: sheet.width
        });
        figures.push({
          colour_rows,
          depth: decoded.depth,
          frames,
          height: sheet.height,
          id: resource.resourceId,
          path,
          resource_file: resourceName,
          width: sheet.width
        });
      }
      if (resourceName === 'AMaps.res') {
        for (const { imag, name } of ANIMATION_ICONS) {
          const icon = decodeImagResource(fork.get('IMAG', imag).data, palette);
          saveClear(icon.pixelIndices, join(dir, `icon-${name}.png`));
          files.push({
            height: icon.height,
            imag,
            path: `animation/icon-${name}.png`,
            width: icon.width
          });
        }
        const frame = decodeImagResource(
          fork.get('IMAG', WINDOW_FRAME_IMAG).data,
          palette
        );
        saveClear(frame.pixelIndices, join(dir, 'window-frame.png'));
        files.push({
          height: frame.height,
          imag: WINDOW_FRAME_IMAG,
          path: 'animation/window-frame.png',
          width: frame.width
        });
      }
    }
  }
  figures.sort((a, b) => a.id - b.id);
  write('figures.json', { figures, icons: ANIMATION_ICONS });
  return { figures, files, tables };
};
