import { describe, expect, test } from 'bun:test';

import { NATIVE_HEIGHT, NATIVE_WIDTH, fitScale } from './screen';

const fit = (width: number, height: number) =>
  fitScale(width, height, NATIVE_WIDTH, NATIVE_HEIGHT);

describe('fitScale', () => {
  test('fills an exact multiple of the native size', () => {
    expect(fit(960, 600)).toEqual({ scale: 3, x: 0, y: 0 });
  });

  test('uses the tighter axis and centres the rest', () => {
    expect(fit(1000, 601)).toEqual({ scale: 3, x: 20, y: 0 });
    expect(fit(641, 1001)).toEqual({ scale: 2, x: 0, y: 300 });
  });

  test('never scales below 1', () => {
    expect(fit(200, 100)).toEqual({ scale: 1, x: -60, y: -50 });
  });

  test('fits a 2560 by 1440 display at 7x', () => {
    expect(fit(2560, 1440)).toEqual({ scale: 7, x: 160, y: 20 });
  });
});
