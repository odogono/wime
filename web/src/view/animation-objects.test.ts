import { describe, expect, test } from 'bun:test';

import {
  groundPictures,
  startErrand,
  stepStage,
  takeLanded,
  type Stage
} from './animation-level';
import type { Figure, ScriptWorld } from './figure-script';

// A script whose object entries only fire their events, then show a
// frame: Take (0xd4) takes the picture up and ends, Put Down (0xde)
// puts it down and ends.
const script = (): number[] => {
  const bytes = Array.from({ length: 256 }, () => 0);
  bytes[0xd4] = 0x81;
  bytes[0xd5] = 0x84;
  bytes[0xd6] = 0x00;
  bytes[0xde] = 0x82;
  bytes[0xdf] = 0x84;
  bytes[0xe0] = 0x00;
  return bytes;
};

const world: Omit<ScriptWorld, 'laggardLine'> = {
  frames: () => [{ height: 20, hot_x: 0, hot_y: 0, width: 10 }],
  line1: 1000,
  line2: 1000,
  random: () => 0,
  script
};

const figure = (owner: number, x: number): Figure => ({
  clamp: 0,
  delay: 10,
  depth: 150,
  flipped: false,
  frame: 0,
  frml: 0,
  next: 0,
  owner,
  pc: 0,
  returns: [],
  speed: 10,
  x,
  y: 150
});

describe('objects on the ground', () => {
  test('lie where the watched Character stands, six at most', () => {
    const at = { x: 640, y: 384 };
    const placements = [
      { object: 3, position: at },
      null,
      { object: 4, position: { x: 641, y: 384 } },
      ...Array.from({ length: 8 }, (_, i) => ({ object: 5 + i, position: at }))
    ];
    const pictures = groundPictures(placements, at, n => n - 1);
    expect(pictures).toHaveLength(6);
    expect(pictures[0]).toEqual({ depth: 0x99, object: 3, x: 239, y: 165 });
    expect(pictures.map(picture => picture.object)).not.toContain(4);
  });
});

describe('errands', () => {
  test('Take walks to the picture, which goes off screen at event 1', () => {
    const stage: Stage = {
      figures: [figure(7, 50), figure(10, 30)],
      party: 2,
      pictures: [{ depth: 0x99, object: 3, x: 220, y: 165 }]
    };
    const sent = startErrand(stage, 'take', 10, 3)!;
    expect(sent.lines?.line1).toBe(220);
    expect(sent.errand).toMatchObject({ kind: 'take', owner: 10, startX: 30 });
    const after = stepStage(sent, world, 0);
    expect(after.pictures![0]!.y).toBe(200);
    expect(after.errand).toBeNull();
  });

  test('Take needs the picture, and any errand a figure', () => {
    const stage: Stage = { figures: [figure(7, 50)], party: 1, pictures: [] };
    expect(startErrand(stage, 'take', 7, 3)).toBeNull();
    expect(startErrand(stage, 'put-down', 9, 3)).toBeNull();
  });

  test('Put Down lays the picture at the figure and then gives its message', () => {
    const stage: Stage = { figures: [figure(7, 50)], party: 1, pictures: [] };
    const sent = startErrand(stage, 'put-down', 7, 2)!;
    const after = stepStage(sent, world, 0);
    expect(after.pictures).toEqual([{ depth: 0x95, object: 2, x: 48, y: 161 }]);
    // Event 4 has ended the errand, but the message is still due, once.
    expect(after.errand).toBeNull();
    const landed = takeLanded(after);
    expect(landed.due).toBe(true);
    expect(takeLanded(landed.stage).due).toBe(false);
  });
});
