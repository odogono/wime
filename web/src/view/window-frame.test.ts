import { describe, expect, test } from 'bun:test';

import {
  frameBox,
  framePieces,
  seededRandom,
  windowStyle,
  type FramePiece
} from './window-frame';

const always =
  (value: number) =>
  (bits: number): number =>
    value & ((1 << bits) - 1);

const tiles = (pieces: FramePiece[]) =>
  pieces.flatMap(piece =>
    piece.kind === 'tile'
      ? [[piece.tile, piece.x, piece.y, piece.mirrored] as const]
      : []
  );

describe('frameBox', () => {
  test('moves x onto a multiple of 8, never left of 8', () => {
    expect(frameBox({ height: 8, width: 16, x: 10, y: 5 }).x).toBe(8);
    expect(frameBox({ height: 8, width: 16, x: 56, y: 5 }).x).toBe(56);
    // The combat window asks for x 6 (finding:ui-combat-window-layout).
    expect(frameBox({ height: 8, width: 16, x: 6, y: 0 }).x).toBe(8);
    expect(frameBox({ height: 8, width: 16, x: 0, y: 0 }).x).toBe(0);
  });

  test('rounds the size up to whole tiles and keeps y', () => {
    expect(frameBox({ height: 34, width: 224, x: 56, y: 5 })).toEqual({
      height: 40,
      width: 224,
      x: 56,
      y: 5
    });
    expect(frameBox({ height: 24, width: 150, x: 10, y: 5 })).toEqual({
      height: 24,
      width: 160,
      x: 8,
      y: 5
    });
  });
});

describe('framePieces', () => {
  test('puts corners and side edges down each side, the right mirrored', () => {
    const pieces = tiles(framePieces(48, 32, always(1)));
    expect(pieces.filter(([, x]) => x === 0)).toEqual([
      [1, 0, 0, false],
      [3, 0, 24, false],
      [9, 0, 8, false],
      [9, 0, 16, false]
    ]);
    expect(pieces.filter(([, x]) => x === 32)).toEqual([
      [1, 32, 0, true],
      [3, 32, 24, true],
      [9, 32, 8, true],
      [9, 32, 16, true]
    ]);
  });

  test('fills the top and bottom with edge tiles', () => {
    const pieces = tiles(framePieces(64, 24, always(3)));
    expect(pieces.filter(([, x]) => x > 0 && x < 48)).toEqual([
      [5, 16, 0, true],
      [5, 32, 0, true],
      [7, 16, 16, true],
      [7, 32, 16, true]
    ]);
  });

  test('draws a plain stretch, with its line along the outside, when the pick is 0', () => {
    const plain = framePieces(48, 24, always(0)).filter(
      piece => piece.kind === 'plain'
    );
    expect(plain).toEqual([
      { kind: 'plain', lineY: 0, x: 16, y: 0 },
      { kind: 'plain', lineY: 7, x: 16, y: 16 }
    ]);
  });

  test('covers the whole ring of a box once', () => {
    const pieces = framePieces(
      96,
      56,
      seededRandom({ height: 56, width: 96, x: 8, y: 8 })
    );
    // 6 across by 7 down, less the 4 by 5 inside.
    expect(pieces).toHaveLength(6 * 7 - 4 * 5);
    const cells = new Set(pieces.map(piece => `${piece.x},${piece.y}`));
    expect(cells.size).toBe(pieces.length);
  });
});

test('seededRandom gives a box the same picks every time', () => {
  const box = { height: 24, width: 160, x: 8, y: 5 };
  const a = seededRandom(box);
  const b = seededRandom(box);
  const picks = Array.from({ length: 20 }, () => [a(2), b(2)]);
  expect(picks.every(([x, y]) => x === y)).toBe(true);
  expect(new Set(picks.map(([x]) => x)).size).toBeGreaterThan(1);
});

test('windowStyle takes the colours from the Level palette', () => {
  const palette = Array.from({ length: 16 }, (_, i) => `#${i}`);
  expect(windowStyle({} as CanvasImageSource, palette).colours).toEqual({
    blue: '#8',
    fill: '#15',
    grey: '#1',
    line: '#3',
    red: '#10',
    text: '#5'
  });
});
