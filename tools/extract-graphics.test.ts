import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'bun:test';

import {
  AmigaOFSImage,
  DEFAULT_ARCHIVE,
  decodeFrmlResource,
  decodeImagResource,
  defaultPalette,
  loadLhaMember,
  mapPalette,
  parseResourceFork,
  stringifySortedJson,
  unpackPackbits
} from './extract-graphics';
import { decodeCstrPayload, extractEmbeddedStrings } from './extract-text';
import { loadCampaignMapAssets } from './render-campaign-map';

test('default palette is the complete 32-colour Amiga palette', () => {
  const palette = defaultPalette();

  expect(palette.length).toBe(256 * 3);
  expect(palette.slice(0, 12)).toEqual([
    0, 0, 0, 255, 255, 255, 136, 136, 136, 68, 68, 68
  ]);
  expect(palette.slice(31 * 3, 32 * 3)).toEqual([224, 224, 224]);
});

test('an FRML frame list gives each frame its hot spot and planes', () => {
  // A 4-plane list (first byte 1) of one 3 by 2 frame at offset 8,
  // hot spot (1, 2): row 0 is colour 1 then 2, row 1 colour 8.
  const data = Uint8Array.from([
    1, 1, 0, 8, 1, 2, 3, 2, 0x80, 0, 0x40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0xe0, 0
  ]);
  const decoded = decodeFrmlResource(data, 0);

  expect(decoded.depth).toBe(4);
  expect(decoded.frames).toHaveLength(1);
  const [frame] = decoded.frames;
  expect([frame!.hotX, frame!.hotY]).toEqual([1, 2]);
  expect(frame!.image.size).toEqual([3, 2]);
  expect([0, 1, 2].map(x => frame!.image.getPixel(x, 0))).toEqual([1, 2, 0]);
  expect([0, 1, 2].map(x => frame!.image.getPixel(x, 1))).toEqual([8, 8, 8]);
});

test('map palette matches the full-map roles', () => {
  const palette = mapPalette();

  expect(palette.length).toBe(256 * 3);
  expect(palette.slice(8 * 3, 8 * 3 + 3)).toEqual([68, 136, 255]);
  expect(palette.slice(10 * 3, 10 * 3 + 3)).toEqual([255, 0, 0]);
  expect(palette.slice(15 * 3, 15 * 3 + 3)).toEqual([255, 238, 170]);
});

test('unpacks PackBits literal and repeat runs', () => {
  // 0x02: copy the next 3 bytes; 0xfe: repeat the next byte 3 times;
  // 0x80: no-op.
  const [unpacked, consumed] = unpackPackbits(
    Uint8Array.from([2, 10, 20, 30, 0xfe, 7, 0x80]),
    6
  );

  expect([...unpacked]).toEqual([10, 20, 30, 7, 7, 7]);
  // Stops as soon as the expected size is reached, before the 0x80 no-op.
  expect(consumed).toBe(6);
});

test('decodes a styled CSTR payload', () => {
  // Styled header (declared length 0xffff), a doubled-character command
  // (ff 6c 00 -> "ll"), then plain text and the NUL terminator.
  const decoded = decodeCstrPayload(
    Uint8Array.from([
      0, 0, 0xff, 0xff, 0x48, 0x65, 0xff, 0x6c, 0x00, 0x6f, 0x00
    ])
  );

  expect(decoded.text).toBe('Hello');
  expect(decoded.warnings).toContain('expanded 0xff doubled-character command');
});

test('writes JSON the way Python json.dumps(sort_keys=True) did', () => {
  expect(stringifySortedJson({ a: 2, b: [1, { c: null, d: 'é' }] })).toBe(
    '{\n  "a": 2,\n  "b": [\n    1,\n    {\n      "c": null,\n      "d": "\\u00e9"\n    }\n  ]\n}'
  );
});

// The remaining tests read the Reference Build, which lives in the
// gitignored artifacts/ dir and is absent in CI; they skip there.
describe.skipIf(!existsSync(DEFAULT_ARCHIVE))('reference archive', () => {
  let disk1: AmigaOFSImage;
  let disk2: AmigaOFSImage;

  beforeAll(() => {
    disk1 = new AmigaOFSImage(
      loadLhaMember(DEFAULT_ARCHIVE, 'WarInMiddleEarth/data/Disk.1')
    );
    disk2 = new AmigaOFSImage(
      loadLhaMember(DEFAULT_ARCHIVE, 'WarInMiddleEarth/data/Disk.2')
    );
  });

  test('reconstructs the expected resource file sizes', () => {
    expect({
      'AAnims.res': disk1.readFile('AAnims.res').length,
      'AMaps.res': disk1.readFile('AMaps.res').length,
      'AScene.res': disk1.readFile('AScene.res').length,
      'ATitle.res': disk1.readFile('ATitle.res').length,
      'BScene.res': disk2.readFile('BScene.res').length
    }).toEqual({
      'AAnims.res': 95_583,
      'AMaps.res': 93_390,
      'AScene.res': 129_250,
      'ATitle.res': 70_729,
      'BScene.res': 745_052
    });
  });

  test('resource parser reports the known graphics counts', () => {
    const resources = [
      ...parseResourceFork(disk1.readFile('AMaps.res')).resources,
      ...parseResourceFork(disk1.readFile('AAnims.res')).resources,
      ...parseResourceFork(disk1.readFile('ATitle.res')).resources,
      ...parseResourceFork(disk1.readFile('AScene.res')).resources,
      ...parseResourceFork(disk2.readFile('BScene.res')).resources
    ];

    expect(
      resources.filter(resource => resource.typeCode === 'IMAG').length
    ).toBe(115);
    expect(
      resources.filter(resource => resource.typeCode === 'FRML').length
    ).toBe(19);
  });

  test('decodes a PackBits planar IMAG resource', () => {
    const resources = parseResourceFork(disk1.readFile('AMaps.res'));
    const decoded = decodeImagResource(resources.get('IMAG', 100).data);

    expect(decoded.width).toBe(80);
    expect(decoded.height).toBe(96);
    expect(decoded.depth).toBe(4);
    expect(decoded.decompressedSize).toBe(3868);
    expect(decoded.pixelIndices.size).toEqual([80, 96]);
  });

  test('decodes row-interleaved bitplanes', () => {
    const resources = parseResourceFork(disk1.readFile('ATitle.res'));
    const decoded = decodeImagResource(resources.get('IMAG', 70).data);

    expect(decoded.pixelIndices.size).toEqual([119, 141]);
    expect(decoded.depth).toBe(5);
    expect(decoded.pixelIndices.getPixel(0, 0)).toBe(13);
    expect(decoded.pixelIndices.getPixel(10, 10)).toBe(20);
    expect(decoded.pixelIndices.getPixel(60, 130)).toBe(0);
  });

  test('decodes packed and plain FRML frame lists', () => {
    const anims = parseResourceFork(disk1.readFile('AAnims.res'));
    const scene = parseResourceFork(disk2.readFile('BScene.res'));
    const ent = anims.get('FRML', 7);
    const hobbit = scene.get('FRML', 0);
    const arrows = scene.get('FRML', 18);

    const entFrames = decodeFrmlResource(ent.data, ent.attributes);
    expect(entFrames.depth).toBe(5);
    expect(entFrames.frames).toHaveLength(10);
    expect(entFrames.frames[0]!.image.size).toEqual([56, 87]);
    expect(decodeFrmlResource(hobbit.data, hobbit.attributes).depth).toBe(4);
    expect(arrows.attributes).toBe(0);
    expect(
      decodeFrmlResource(arrows.data, arrows.attributes).frames.map(
        frame => frame.image.size
      )
    ).toEqual([
      [19, 5],
      [12, 5],
      [13, 5],
      [15, 5],
      [12, 16]
    ]);
  });

  test('campaign map assets decode from AMaps', () => {
    const assets = loadCampaignMapAssets(DEFAULT_ARCHIVE);

    expect(assets.tiles.length).toBe(320);
    expect(assets.mapIndices.length).toBe(16_256);
    expect(assets.tiles[33]!.size).toEqual([16, 16]);
    expect([...assets.mapIndices.subarray(0, 17)]).toEqual(Array(17).fill(0));
  });

  test('text resources decode CSTR and styled strings', () => {
    const atext = parseResourceFork(disk1.readFile('AText.res'));
    const bscene = parseResourceFork(disk2.readFile('BScene.res'));

    const atextString = decodeCstrPayload(atext.get('CSTR', 57).data);
    const styledString = decodeCstrPayload(bscene.get('CSTR', 56).data);

    expect(atext.byType('CSTR').length).toBe(4);
    expect(bscene.byType('CSTR').length).toBe(57);
    expect(atextString.text).toContain('Three Rings for the Elven-kings');
    expect(styledString.text).toContain('I will return as\nsoon as I can');
    expect(styledString.text).toContain('Rivendell');
  });

  test('executable string scan finds UI text', () => {
    const strings = extractEmbeddedStrings(disk1.readFile('WarInMiddleEarth'));
    const texts = new Set(strings.map(record => record.text));

    expect(texts.has('Sound is now off.')).toBe(true);
    expect(texts.has('The Game is Paused.')).toBe(true);
    expect(texts.has('Are you certain you want to quit?')).toBe(true);
  });
});
