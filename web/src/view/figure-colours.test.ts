import { describe, expect, test } from 'bun:test';

import { drawFigures } from './animation-level';
import type { AnimationAssets, FigureSetAsset } from './assets';
import { drawEndingFigures, endingFigures } from './ending-scene';
import { newFigure } from './figure-script';

const frame = { height: 40, hot_x: 0, hot_y: 0, width: 16, x: 0 };
const sets = new Map<number, FigureSetAsset>(
  [0, 1, 2, 3, 4, 6, 8, 9, 12].map(id => [
    id,
    {
      colour_rows: {
        0: 0,
        1: 40,
        11: 440,
        12: 480,
        14: 560,
        2: 80,
        24: 960,
        3: 120,
        4: 160,
        5: 200,
        6: 240
      },
      depth: 4,
      frames: Array.from({ length: 17 }, () => frame),
      id,
      sheet: {} as HTMLImageElement
    }
  ])
);

const drawing = () => {
  const rows: number[] = [];
  const ctx = {
    drawImage(_image: CanvasImageSource, _x: number, y: number) {
      rows.push(y);
    },
    restore() {},
    save() {},
    scale() {},
    translate() {}
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rows };
};

describe('figure colours at the drawing boundary', () => {
  test('the winning picture selects the wizard and each man’s colour variant', () => {
    const { ctx, rows } = drawing();
    drawEndingFigures(
      ctx,
      sets,
      endingFigures('won-mount-doom', () => 0)
    );
    // Drawing order is right to left; the absent dwarf has no frame 17.
    expect(rows).toEqual([960, 440, 120, 560, 240, 200, 80, 480]);
  });

  test('the losing picture copies five-plane enemies unchanged and colours the hooded row', () => {
    const { ctx, rows } = drawing();
    drawEndingFigures(
      ctx,
      sets,
      endingFigures('lost-barad-dur', () => 0)
    );
    expect(rows.slice(0, -9).every(row => row === 0)).toBe(true);
    expect(rows.slice(-9)).toEqual(Array<number>(9).fill(40));
  });

  test('ordinary Animation Level figures select their owner’s colours with the same FRML set', () => {
    const { ctx, rows } = drawing();
    const world = {
      frames: () => [frame],
      laggardLine: 0,
      line1: 0,
      line2: 0,
      random: () => 0,
      script: () => [0]
    };
    const assets = {
      figures: sets,
      tables: { figure_colours: [0, 4, 14, 24] }
    } as AnimationAssets;
    drawFigures(ctx, assets, {
      figures: [
        newFigure(world, 4, 0, 0, 0, 0, 1),
        newFigure(world, 2, 0, 0, 0, 0, 2),
        newFigure(world, 2, 0, 0, 0, 0, 3)
      ],
      party: 3
    });
    expect(rows).toEqual([160, 560, 960]);
  });
});
