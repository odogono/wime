#!/usr/bin/env bun
// Extract graphics resources from the WHDLoad War In Middle Earth archive.
//
//   bun tools/extract-graphics.ts [ARCHIVE] [--out DIR]
//
// ARCHIVE defaults to the Reference Build in artifacts/amiga/, found through
// the main checkout when run from a git worktree. Outputs go to
// extracted_graphics/ by default.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { PNG } from 'pngjs';

import { drawSheetLabel, type RgbaImage } from './sheet-font';

// Locate the untracked artifacts/ dir, falling back to the main checkout
// when run from a git worktree.
export const findArtifactsDir = (): string => {
  const root = resolve(import.meta.dir, '..');
  if (existsSync(join(root, 'artifacts'))) {
    return join(root, 'artifacts');
  }
  try {
    const common = execFileSync(
      'git',
      ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8' }
    ).trim();
    return join(dirname(common), 'artifacts');
  } catch {
    return join(root, 'artifacts');
  }
};

export const ARTIFACTS_DIR = findArtifactsDir();
export const DEFAULT_ARCHIVE = join(
  ARTIFACTS_DIR,
  'amiga',
  'WarInMiddleEarth_v1.0_0968.lha'
);
export const BLOCK_SIZE = 512;
export const RESOURCE_FILES: Record<string, [string, string[]]> = {
  disk1: [
    'WarInMiddleEarth/data/Disk.1',
    ['AMaps.res', 'AAnims.res', 'ATitle.res', 'AScene.res']
  ],
  disk2: ['WarInMiddleEarth/data/Disk.2', ['BScene.res']]
};

export class ExtractError extends Error {}

export const beS32 = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset).getInt32(offset, false);

export const beU32 = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset).getUint32(offset, false);

export const beU24 = (data: Uint8Array, offset: number): number =>
  (data[offset]! << 16) | (data[offset + 1]! << 8) | data[offset + 2]!;

export const beS16 = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset).getInt16(offset, false);

export const beU16 = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset).getUint16(offset, false);

export const safeName = (value: string): string =>
  [...value]
    .map(char => (/[\p{L}\p{N}\-_.]/u.test(char) ? char : '_'))
    .join('');

export const loadLhaMember = (archive: string, member: string): Uint8Array => {
  try {
    return execFileSync('lha', ['pq', archive, member], {
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      throw new ExtractError('lha is required on PATH (brew install lhasa)');
    }
    throw new ExtractError(`failed to extract ${member} from ${archive}`);
  }
};

// JSON.stringify with Python's json.dumps(..., indent=2, sort_keys=True)
// output: keys sorted at every level and non-ASCII escaped, so
// manifests stay byte-identical to the Python tools' output.
export const stringifySortedJson = (value: unknown): string => {
  const sorted = (entry: unknown): unknown => {
    if (Array.isArray(entry)) {
      return entry.map(sorted);
    }
    if (entry !== null && typeof entry === 'object') {
      return Object.fromEntries(
        Object.entries(entry)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, item]) => [key, sorted(item)])
      );
    }
    return entry;
  };
  const text = JSON.stringify(sorted(value), null, 2);
  return text.replaceAll(
    /[\u007f-\uffff]/g,
    char => String.raw`\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
};

const latin1 = (data: Uint8Array): string =>
  [...data].map(byte => String.fromCharCode(byte)).join('');

export class AmigaOFSImage {
  readonly data: Uint8Array;
  readonly blockCount: number;
  readonly files: Map<string, number>;

  constructor(data: Uint8Array) {
    if (data.length % BLOCK_SIZE !== 0) {
      throw new ExtractError(
        `disk image size is not a multiple of ${BLOCK_SIZE}: ${data.length}`
      );
    }
    if (latin1(data.subarray(0, 3)) !== 'DOS') {
      throw new ExtractError(
        'disk image does not start with an AmigaDOS signature'
      );
    }
    this.data = data;
    this.blockCount = data.length / BLOCK_SIZE;
    this.files = this.scanFileHeaders();
  }

  block(number: number): Uint8Array {
    if (number < 0 || number >= this.blockCount) {
      throw new ExtractError(`block out of range: ${number}`);
    }
    const start = number * BLOCK_SIZE;
    return this.data.subarray(start, start + BLOCK_SIZE);
  }

  readFile(filename: string): Uint8Array {
    const headerBlock = this.files.get(filename.toLowerCase());
    if (headerBlock === undefined) {
      const available = [...this.files.keys()].sort().join(', ');
      throw new ExtractError(
        `${filename} not found in disk image; available: ${available}`
      );
    }
    return this.readFileByHeader(headerBlock);
  }

  readFileByHeader(headerBlock: number): Uint8Array {
    const header = this.block(headerBlock);
    if (beS32(header, 0) !== 2 || beS32(header, 508) !== -3) {
      throw new ExtractError(`block ${headerBlock} is not an OFS file header`);
    }

    const expectedSize = beU32(header, 324);
    const dataBlocks: number[] = [];
    let current = headerBlock;
    const seen = new Set<number>();

    while (current !== 0 && !seen.has(current)) {
      seen.add(current);
      const block = this.block(current);
      const type = beS32(block, 0);
      if (type !== 2 && type !== 16) {
        throw new ExtractError(
          `block ${current} is not a file header/extension block`
        );
      }
      for (let offset = 24; offset < 312; offset += 4) {
        const pointer = beU32(block, offset);
        if (pointer !== 0) {
          dataBlocks.push(pointer);
        }
      }
      current = beU32(block, 504);
    }

    const chunks: [number, Uint8Array][] = [];
    for (const pointer of dataBlocks) {
      const dataBlock = this.block(pointer);
      if (beS32(dataBlock, 0) !== 8) {
        throw new ExtractError(`block ${pointer} is not an OFS data block`);
      }
      const sequence = beU32(dataBlock, 8);
      const size = beU32(dataBlock, 12);
      chunks.push([sequence, dataBlock.subarray(24, 24 + size)]);
    }

    chunks.sort((left, right) => left[0] - right[0]);
    const payload = new Uint8Array(
      chunks.reduce((total, [, chunk]) => total + chunk.length, 0)
    );
    let position = 0;
    for (const [, chunk] of chunks) {
      payload.set(chunk, position);
      position += chunk.length;
    }
    return payload.subarray(0, expectedSize);
  }

  private scanFileHeaders(): Map<string, number> {
    const files = new Map<string, number>();
    for (let blockNumber = 0; blockNumber < this.blockCount; blockNumber++) {
      const block = this.block(blockNumber);
      if (beS32(block, 0) !== 2 || beS32(block, 508) !== -3) {
        continue;
      }
      const name = AmigaOFSImage.readHeaderName(block);
      if (name !== null && name !== '') {
        files.set(name.toLowerCase(), blockNumber);
      }
    }
    return files;
  }

  private static readHeaderName(block: Uint8Array): string | null {
    const length = block[432]!;
    if (length === 0 || length > 107 || 433 + length > block.length) {
      return null;
    }
    const rawName = block.subarray(433, 433 + length);
    if ([...rawName].some(byte => byte < 32 || byte > 126)) {
      return null;
    }
    return latin1(rawName);
  }
}

export type Resource = {
  attributes: number;
  data: Uint8Array;
  dataOffset: number;
  name: string | null;
  resourceId: number;
  typeCode: string;
};

export class ResourceFork {
  readonly resources: Resource[];

  constructor(resources: Resource[]) {
    this.resources = resources;
  }

  get(typeCode: string, resourceId: number): Resource {
    for (const resource of this.resources) {
      if (
        resource.typeCode === typeCode &&
        resource.resourceId === resourceId
      ) {
        return resource;
      }
    }
    throw new ExtractError(`no ${typeCode} resource with id ${resourceId}`);
  }

  byType(typeCode: string): Resource[] {
    return this.resources.filter(resource => resource.typeCode === typeCode);
  }
}

export const parseResourceFork = (data: Uint8Array): ResourceFork => {
  if (data.length < 16) {
    throw new ExtractError('resource fork is too short');
  }

  const dataOffset = beU32(data, 0);
  const mapOffset = beU32(data, 4);
  const dataLength = beU32(data, 8);
  const mapLength = beU32(data, 12);
  if (
    dataOffset + dataLength > data.length ||
    mapOffset + mapLength > data.length
  ) {
    throw new ExtractError('resource fork header points outside the file');
  }

  const typeListOffset = beU16(data, mapOffset + 24);
  const nameListOffset = beU16(data, mapOffset + 26);
  const typeListBase = mapOffset + typeListOffset;
  const nameListBase = mapOffset + nameListOffset;
  const typeCount = beU16(data, typeListBase) + 1;

  const resources: Resource[] = [];
  for (let typeIndex = 0; typeIndex < typeCount; typeIndex++) {
    const typeEntry = typeListBase + 2 + typeIndex * 8;
    const typeCode = latin1(data.subarray(typeEntry, typeEntry + 4));
    const resourceCount = beU16(data, typeEntry + 4) + 1;
    const referenceListBase = typeListBase + beU16(data, typeEntry + 6);

    for (
      let resourceIndex = 0;
      resourceIndex < resourceCount;
      resourceIndex++
    ) {
      const reference = referenceListBase + resourceIndex * 12;
      const resourceId = beS16(data, reference);
      const nameOffset = beS16(data, reference + 2);
      const attributes = data[reference + 4]!;
      const resourceDataOffset = beU24(data, reference + 5);
      const dataPosition = dataOffset + resourceDataOffset;
      const resourceLength = beU32(data, dataPosition);
      const payloadStart = dataPosition + 4;
      const payloadEnd = payloadStart + resourceLength;
      if (payloadEnd > dataOffset + dataLength) {
        throw new ExtractError(
          `${typeCode} ${resourceId} extends outside resource data`
        );
      }

      let name: string | null = null;
      if (nameOffset !== -1) {
        const namePosition = nameListBase + nameOffset;
        const nameLength = data[namePosition]!;
        name = latin1(
          data.subarray(namePosition + 1, namePosition + 1 + nameLength)
        );
      }

      resources.push({
        attributes,
        data: data.subarray(payloadStart, payloadEnd),
        dataOffset: resourceDataOffset,
        name,
        resourceId,
        typeCode
      });
    }
  }

  return new ResourceFork(resources);
};

export const unpackPackbits = (
  data: Uint8Array,
  expectedSize: number
): [Uint8Array, number] => {
  const output: number[] = [];
  let offset = 0;
  while (offset < data.length && output.length < expectedSize) {
    const token = data[offset]!;
    offset += 1;
    if (token <= 127) {
      const count = token + 1;
      for (let i = 0; i < count && offset + i < data.length; i++) {
        output.push(data[offset + i]!);
      }
      offset += count;
    } else if (token >= 129) {
      const count = 257 - token;
      if (offset >= data.length) {
        break;
      }
      for (let i = 0; i < count; i++) {
        output.push(data[offset]!);
      }
      offset += 1;
    }
  }
  return [Uint8Array.from(output.slice(0, expectedSize)), offset];
};

// A paletted image: one palette index per pixel, row-major, plus the
// palette as 256 RGB triples. This replaces Pillow's "P" mode images.
export class IndexedImage {
  readonly width: number;
  readonly height: number;
  readonly indices: Uint8Array;
  palette: number[];

  constructor(width: number, height: number, palette?: number[]) {
    this.width = width;
    this.height = height;
    this.indices = new Uint8Array(width * height);
    this.palette = palette ?? defaultPalette();
  }

  get size(): [number, number] {
    return [this.width, this.height];
  }

  getPixel(x: number, y: number): number {
    return this.indices[y * this.width + x]!;
  }

  setPixel(x: number, y: number, value: number): void {
    this.indices[y * this.width + x] = value;
  }

  paste(source: IndexedImage, x: number, y: number): void {
    for (let row = 0; row < source.height; row++) {
      const targetRow = y + row;
      if (targetRow < 0 || targetRow >= this.height) {
        continue;
      }
      for (let column = 0; column < source.width; column++) {
        const targetColumn = x + column;
        if (targetColumn < 0 || targetColumn >= this.width) {
          continue;
        }
        this.indices[targetRow * this.width + targetColumn] =
          source.indices[row * source.width + column]!;
      }
    }
  }

  toRgba(): RgbaImage {
    const data = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < this.indices.length; i++) {
      const paletteIndex = this.indices[i]! * 3;
      data[i * 4] = this.palette[paletteIndex] ?? 0;
      data[i * 4 + 1] = this.palette[paletteIndex + 1] ?? 0;
      data[i * 4 + 2] = this.palette[paletteIndex + 2] ?? 0;
      data[i * 4 + 3] = 255;
    }
    return { data, height: this.height, width: this.width };
  }

  save(path: string): void {
    writeRgbaPng(path, this.toRgba());
  }
}

export const writeRgbaPng = (path: string, image: RgbaImage): void => {
  const png = new PNG({ height: image.height, width: image.width });
  png.data = Buffer.from(image.data);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
};

export const makeRgbaImage = (
  width: number,
  height: number,
  fill: [number, number, number]
): RgbaImage => {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { data, height, width };
};

export const pasteRgba = (
  target: RgbaImage,
  source: RgbaImage,
  x: number,
  y: number
): void => {
  for (let row = 0; row < source.height; row++) {
    const targetRow = y + row;
    if (targetRow < 0 || targetRow >= target.height) {
      continue;
    }
    for (let column = 0; column < source.width; column++) {
      const targetColumn = x + column;
      if (targetColumn < 0 || targetColumn >= target.width) {
        continue;
      }
      const sourceIndex = (row * source.width + column) * 4;
      const targetIndex = (targetRow * target.width + targetColumn) * 4;
      target.data[targetIndex] = source.data[sourceIndex]!;
      target.data[targetIndex + 1] = source.data[sourceIndex + 1]!;
      target.data[targetIndex + 2] = source.data[sourceIndex + 2]!;
      target.data[targetIndex + 3] = source.data[sourceIndex + 3]!;
    }
  }
};

export type DecodedBitmap = {
  decompressedSize: number;
  depth: number;
  height: number;
  pixelIndices: IndexedImage;
  warnings: string[];
  width: number;
};

export const decodeImagResource = (
  data: Uint8Array,
  palette?: number[]
): DecodedBitmap => {
  const warnings: string[] = [];
  if (data.length < 28) {
    throw new ExtractError('IMAG resource is too short');
  }

  let decompressed: Uint8Array;
  let expectedSize: number;
  if (beU16(data, 0) === 0x02_00) {
    decompressed = data;
    expectedSize = data.length;
  } else {
    expectedSize = beU32(data, 0);
    const [unpacked, consumed] = unpackPackbits(data.subarray(4), expectedSize);
    decompressed = unpacked;
    if (decompressed.length !== expectedSize) {
      throw new ExtractError(
        `PackBits output is ${decompressed.length} bytes, expected ${expectedSize}`
      );
    }
    if (consumed < data.length - 4) {
      const trailing = data.length - 4 - consumed;
      if (trailing !== 0) {
        warnings.push(`${trailing} trailing compressed bytes`);
      }
    }
  }

  if (beU16(decompressed, 0) !== 0x02_00) {
    throw new ExtractError(
      'decompressed IMAG header does not start with 0x0200'
    );
  }

  const depth = decompressed[5]!;
  const width = beU16(decompressed, 20);
  const height = beU16(decompressed, 22);
  if (depth <= 0 || depth > 8) {
    throw new ExtractError(`unsupported bit depth: ${depth}`);
  }
  if (width <= 0 || height <= 0) {
    throw new ExtractError(`invalid dimensions: ${width}x${height}`);
  }

  const rowBytes = Math.ceil(width / 16) * 2;
  const expectedBitmapSize = 28 + rowBytes * height * depth;
  if (decompressed.length < expectedBitmapSize) {
    throw new ExtractError(
      `bitmap data is short: ${decompressed.length} bytes, expected at least ${expectedBitmapSize}`
    );
  }
  if (decompressed.length > expectedBitmapSize) {
    warnings.push(
      `${decompressed.length - expectedBitmapSize} extra decompressed bytes`
    );
  }

  const bitmap = decompressed.subarray(28, expectedBitmapSize);
  const image = new IndexedImage(width, height, palette ?? defaultPalette());

  // The decompressed resources store rows as plane 0 row, plane 1 row, ...
  // for each scanline. This matches the way Amiga BitMap rows are commonly
  // serialized when multiple plane pointers reference one contiguous buffer.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byteIndex = Math.floor(x / 8);
      const mask = 0x80 >> (x % 8);
      let value = 0;
      for (let plane = 0; plane < depth; plane++) {
        const rowOffset = y * depth * rowBytes + plane * rowBytes;
        if ((bitmap[rowOffset + byteIndex]! & mask) !== 0) {
          value |= 1 << plane;
        }
      }
      image.setPixel(x, y, value);
    }
  }

  return {
    decompressedSize: expectedSize,
    depth,
    height,
    pixelIndices: image,
    warnings,
    width
  };
};

// One frame of an FRML frame list: its bitmap and the hot spot the
// game subtracts from a figure's position to place it (code+0x038a0).
export type FrmlFrame = {
  hotX: number;
  hotY: number;
  image: IndexedImage;
};

export type DecodedFrameList = {
  decompressedSize: number;
  depth: number;
  frames: FrmlFrame[];
  warnings: string[];
};

// Resource attribute bit 0 marks a payload packed as a 4-byte unpacked
// size and PackBits; FRML 18 and 19 in BScene.res are stored plain.
export const RESOURCE_COMPRESSED = 0x01;

// An FRML resource (finding:data-formats-frml-frame-lists) is a byte
// that is 1 for 4-plane figures and 0 for 5-plane ones, a frame count
// byte, and six bytes a frame: a word offset of its bitmap from the
// start, then hot spot x and y, width and height in bytes. The bitmaps
// are stored like IMAG ones, each scanline's planes in turn.
export const decodeFrmlResource = (
  data: Uint8Array,
  attributes: number,
  palette?: number[]
): DecodedFrameList => {
  const warnings: string[] = [];
  let decompressed = data;
  if (attributes & RESOURCE_COMPRESSED) {
    const expectedSize = beU32(data, 0);
    [decompressed] = unpackPackbits(data.subarray(4), expectedSize);
    if (decompressed.length !== expectedSize) {
      throw new ExtractError(
        `PackBits output is ${decompressed.length} bytes, expected ${expectedSize}`
      );
    }
  }
  if (decompressed.length < 2) {
    throw new ExtractError('FRML resource is too short');
  }
  const depth = decompressed[0] === 1 ? 4 : 5;
  const count = decompressed[1]!;
  const frames: FrmlFrame[] = [];
  let end = 0;
  for (let index = 0; index < count; index++) {
    const entry = 2 + index * 6;
    const offset = beU16(decompressed, entry);
    const width = decompressed[entry + 4]!;
    const height = decompressed[entry + 5]!;
    const rowBytes = Math.ceil(width / 16) * 2;
    end = offset + rowBytes * depth * height;
    if (end > decompressed.length) {
      throw new ExtractError(`FRML frame ${index} extends past the resource`);
    }
    const image = new IndexedImage(width, height, palette ?? defaultPalette());
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let value = 0;
        for (let plane = 0; plane < depth; plane++) {
          const byte = offset + (y * depth + plane) * rowBytes + (x >> 3);
          if (decompressed[byte]! & (0x80 >> (x & 7))) {
            value |= 1 << plane;
          }
        }
        image.setPixel(x, y, value);
      }
    }
    frames.push({
      hotX: decompressed[entry + 2]!,
      hotY: decompressed[entry + 3]!,
      image
    });
  }
  if (end < decompressed.length) {
    warnings.push(`${decompressed.length - end} bytes after the last frame`);
  }
  return {
    decompressedSize: decompressed.length,
    depth,
    frames,
    warnings
  };
};

const flattenPalette = (rgb: [number, number, number][]): number[] => {
  const flattened: number[] = [];
  for (const [red, green, blue] of rgb) {
    flattened.push(red, green, blue);
  }
  while (flattened.length < 256 * 3) {
    flattened.push(0, 0, 0);
  }
  return flattened;
};

export const defaultPalette = (): number[] =>
  // War In Middle Earth uses this 32-colour Amiga-style palette for the
  // decoded resource graphics.
  flattenPalette([
    [0, 0, 0],
    [255, 255, 255],
    [136, 136, 136],
    [68, 68, 68],
    [136, 0, 0],
    [204, 68, 0],
    [238, 170, 68],
    [255, 238, 136],
    [0, 68, 0],
    [0, 136, 0],
    [68, 170, 68],
    [136, 204, 102],
    [0, 0, 136],
    [0, 68, 204],
    [68, 136, 238],
    [136, 204, 255],
    [68, 0, 68],
    [136, 0, 136],
    [204, 68, 204],
    [238, 136, 238],
    [0, 68, 68],
    [0, 136, 136],
    [68, 204, 204],
    [136, 238, 238],
    [102, 68, 34],
    [153, 102, 51],
    [204, 153, 85],
    [238, 204, 136],
    [32, 32, 32],
    [96, 96, 96],
    [160, 160, 160],
    [224, 224, 224]
  ]);

export const mapPalette = (): number[] =>
  flattenPalette([
    [0, 0, 0],
    [68, 68, 68],
    [119, 119, 119],
    [153, 136, 119],
    [187, 153, 136],
    [0, 51, 0],
    [0, 85, 0],
    [34, 102, 17],
    [68, 136, 255],
    [119, 187, 255],
    [255, 0, 0],
    [0, 204, 0],
    [0, 221, 187],
    [0, 0, 0],
    [0, 255, 0],
    [255, 238, 170]
  ]);

// The Animation Level's 32 colours, the RGB4 words at data+0x4b48
// (finding:graphics-animation-level-palette).
const ANIMATION_LEVEL_RGB4 = [
  0x0_00, 0xd_ca, 0x2_ae, 0x2_7c, 0x4_26, 0x4_66, 0x7_94, 0xa_c7, 0x4_52,
  0x6_72, 0x0_4b, 0x2_7c, 0x2_ae, 0x8_df, 0xd_a3, 0xe_e6, 0x1_22, 0x5_44,
  0x9_00, 0xc_00, 0xa_2a, 0xd_8d, 0x8_9a, 0xc_de, 0xb_50, 0xe_70, 0x4_10,
  0x7_31, 0x9_64, 0xc_96, 0xd_86, 0xf_c8
];

export const animationLevelPalette = (): number[] =>
  flattenPalette(
    ANIMATION_LEVEL_RGB4.map(word => [
      ((word >> 8) & 0xf) * 17,
      ((word >> 4) & 0xf) * 17,
      (word & 0xf) * 17
    ])
  );

const ANIMATION_LEVEL_FILES = new Set([
  'aanims.res',
  'ascene.res',
  'bscene.res'
]);

export const paletteForResourceFile = (
  resourceName: string
): [string, number[]] => {
  if (resourceName.toLowerCase() === 'amaps.res') {
    return ['War In Middle Earth full-map palette', mapPalette()];
  }
  if (ANIMATION_LEVEL_FILES.has(resourceName.toLowerCase())) {
    return [
      'War In Middle Earth Animation Level palette',
      animationLevelPalette()
    ];
  }
  return ['War In Middle Earth 32-colour art palette', defaultPalette()];
};

// Round to whichever neighbouring whole number scores lower on `key`, never
// below 1.
const roundAspect = (number: number, key: (n: number) => number): number => {
  const floor = Math.floor(number);
  const ceil = Math.ceil(number);
  return Math.max(key(floor) <= key(ceil) ? floor : ceil, 1);
};

// Pillow's Image.thumbnail size choice: fit inside the box preserving
// aspect ratio, rounding to whichever of floor/ceil keeps the aspect
// closer, and never enlarging.
const thumbnailSize = (
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number
): [number, number] => {
  if (boxWidth >= width && boxHeight >= height) {
    return [width, height];
  }
  const aspect = width / height;
  if (boxWidth / boxHeight >= aspect) {
    return [
      roundAspect(boxHeight * aspect, n => Math.abs(aspect - n / boxHeight)),
      boxHeight
    ];
  }
  return [
    boxWidth,
    roundAspect(boxWidth / aspect, n =>
      n === 0 ? 0 : Math.abs(aspect - boxWidth / n)
    )
  ];
};

// Nearest-neighbour resize, matching Pillow's Resampling.NEAREST: an
// affine scale that starts half a step in and accumulates the step in
// floating point, truncating to pick each source pixel. The accumulation
// matters - computing (x + 0.5) * scale per pixel picks a different
// source pixel where the accumulated error crosses an integer.
const resizeNearestRgba = (
  image: RgbaImage,
  width: number,
  height: number
): RgbaImage => {
  if (width === image.width && height === image.height) {
    return image;
  }
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  const sourceXs: number[] = [];
  let xo = scaleX * 0.5;
  for (let x = 0; x < width; x++) {
    sourceXs.push(Math.min(Math.trunc(xo), image.width - 1));
    xo += scaleX;
  }
  const data = new Uint8Array(width * height * 4);
  let yo = scaleY * 0.5;
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(Math.trunc(yo), image.height - 1);
    yo += scaleY;
    for (let x = 0; x < width; x++) {
      const sourceIndex = (sourceY * image.width + sourceXs[x]!) * 4;
      const targetIndex = (y * width + x) * 4;
      data[targetIndex] = image.data[sourceIndex]!;
      data[targetIndex + 1] = image.data[sourceIndex + 1]!;
      data[targetIndex + 2] = image.data[sourceIndex + 2]!;
      data[targetIndex + 3] = image.data[sourceIndex + 3]!;
    }
  }
  return { data, height, width };
};

export const saveContactSheet = (
  images: [string, IndexedImage][],
  outputPath: string
): void => {
  if (images.length === 0) {
    return;
  }
  const thumbWidth = 160;
  const labelHeight = 14;
  const padding = 8;
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(images.length))));
  const rows = Math.ceil(images.length / columns);
  const cellWidth = thumbWidth + padding;
  const cellHeight = thumbWidth + labelHeight + padding;
  const sheet = makeRgbaImage(
    columns * cellWidth + padding,
    rows * cellHeight + padding,
    [24, 24, 24]
  );

  images.forEach(([label, image], index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = padding + column * cellWidth;
    const y = padding + row * cellHeight;
    const [previewWidth, previewHeight] = thumbnailSize(
      image.width,
      image.height,
      thumbWidth,
      thumbWidth
    );
    const preview = resizeNearestRgba(
      image.toRgba(),
      previewWidth,
      previewHeight
    );
    pasteRgba(sheet, preview, x, y);
    drawSheetLabel(
      sheet,
      x,
      y + thumbWidth,
      label.slice(0, 24),
      [230, 230, 230]
    );
  });

  writeRgbaPng(outputPath, sheet);
};

type ResourceEntry = {
  decompressed_size?: number;
  depth?: number;
  frames?: number;
  height?: number;
  id: number;
  length: number;
  name: string | null;
  output?: string;
  palette_source?: string;
  status: string;
  type: string;
  warnings: string[];
  width?: number;
};

type FileManifest = {
  disk: string;
  palette_source: string;
  resource_file: string;
  resources: ResourceEntry[];
  size: number;
  source_member: string;
};

export type GraphicsManifest = {
  archive: string;
  palette: { source: string; status: string };
  resource_files: FileManifest[];
  summary: {
    frml_decoded: number;
    frml_total: number;
    imag_decoded: number;
    imag_total: number;
    warnings: number;
  };
};

export const extractArchive = (
  archive: string,
  outputDir: string
): GraphicsManifest => {
  mkdirSync(outputDir, { recursive: true });
  const manifest: GraphicsManifest = {
    archive,
    palette: {
      source: 'resource-specific palettes',
      status:
        'AMaps.res uses the full-map palette; other IMAG resources use the art palette'
    },
    resource_files: [],
    summary: {
      frml_decoded: 0,
      frml_total: 0,
      imag_decoded: 0,
      imag_total: 0,
      warnings: 0
    }
  };

  for (const [diskName, [memberName, resourceNames]] of Object.entries(
    RESOURCE_FILES
  )) {
    const disk = new AmigaOFSImage(loadLhaMember(archive, memberName));
    for (const resourceName of resourceNames) {
      const resourceData = disk.readFile(resourceName);
      const resourceFork = parseResourceFork(resourceData);
      const [paletteSource, palette] = paletteForResourceFile(resourceName);
      const fileManifest: FileManifest = {
        disk: diskName,
        palette_source: paletteSource,
        resource_file: resourceName,
        resources: [],
        size: resourceData.length,
        source_member: memberName
      };
      const resourceOutputDir = join(outputDir, safeName(resourceName));
      const imagSheetInputs: [string, IndexedImage][] = [];

      for (const resource of resourceFork.resources) {
        const entry: ResourceEntry = {
          id: resource.resourceId,
          length: resource.data.length,
          name: resource.name,
          status: 'skipped',
          type: resource.typeCode,
          warnings: []
        };

        if (resource.typeCode === 'IMAG') {
          manifest.summary.imag_total += 1;
          try {
            const decoded = decodeImagResource(resource.data, palette);
            const filename = `IMAG_${resource.resourceId}.png`;
            const path = join(resourceOutputDir, 'IMAG', filename);
            decoded.pixelIndices.save(path);
            entry.status = 'decoded';
            entry.output = relative(outputDir, path).split(sep).join('/');
            entry.width = decoded.width;
            entry.height = decoded.height;
            entry.depth = decoded.depth;
            entry.decompressed_size = decoded.decompressedSize;
            entry.palette_source = paletteSource;
            entry.warnings.push(...decoded.warnings);
            manifest.summary.imag_decoded += 1;
            imagSheetInputs.push([
              String(resource.resourceId),
              decoded.pixelIndices
            ]);
          } catch (error) {
            entry.status = 'warning';
            entry.warnings.push(
              error instanceof Error ? error.message : String(error)
            );
          }
        } else if (resource.typeCode === 'FRML') {
          manifest.summary.frml_total += 1;
          try {
            const decoded = decodeFrmlResource(
              resource.data,
              resource.attributes,
              palette
            );
            // The frames side by side, two pixels apart, in order.
            const width = decoded.frames.reduce(
              (total, frame) => total + frame.image.width + 2,
              0
            );
            const height = Math.max(
              1,
              ...decoded.frames.map(frame => frame.image.height)
            );
            const strip = new IndexedImage(Math.max(1, width), height, palette);
            let x = 0;
            for (const frame of decoded.frames) {
              strip.paste(frame.image, x, 0);
              x += frame.image.width + 2;
            }
            const path = join(
              resourceOutputDir,
              'FRML',
              `FRML_${resource.resourceId}.png`
            );
            strip.save(path);
            entry.status = 'decoded';
            entry.output = relative(outputDir, path).split(sep).join('/');
            entry.frames = decoded.frames.length;
            entry.depth = decoded.depth;
            entry.decompressed_size = decoded.decompressedSize;
            entry.warnings.push(...decoded.warnings);
            manifest.summary.frml_decoded += 1;
          } catch (error) {
            entry.status = 'warning';
            entry.warnings.push(
              error instanceof Error ? error.message : String(error)
            );
          }
        } else if (
          resource.typeCode === 'MMAP' ||
          resource.typeCode === 'CHAR'
        ) {
          entry.status = 'warning';
          entry.warnings.push(
            `${resource.typeCode} payload was enumerated but its map/character format is not decoded yet`
          );
        }

        if (entry.warnings.length > 0) {
          manifest.summary.warnings += entry.warnings.length;
        }
        fileManifest.resources.push(entry);
      }

      saveContactSheet(
        imagSheetInputs,
        join(resourceOutputDir, `${safeName(resourceName)}_IMAG_sheet.png`)
      );
      manifest.resource_files.push(fileManifest);
    }
  }

  writeFileSync(
    join(outputDir, 'manifest.json'),
    stringifySortedJson(manifest),
    'utf8'
  );
  return manifest;
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: { out: { default: 'extracted_graphics', type: 'string' } }
  });
  const archive = positionals[0] ?? DEFAULT_ARCHIVE;
  const out = values.out ?? 'extracted_graphics';
  const manifest = extractArchive(archive, out);
  const summary = manifest.summary;
  console.log(
    `decoded ${summary.imag_decoded}/${summary.imag_total} IMAG resources; ` +
      `decoded ${summary.frml_decoded}/${summary.frml_total} FRML resources; ` +
      `${summary.warnings} warnings; manifest written to ${join(out, 'manifest.json')}`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
