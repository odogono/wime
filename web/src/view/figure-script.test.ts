import { describe, expect, test } from 'bun:test';

import {
  STOPPED,
  newFigure,
  startScript,
  stepFigure,
  type Figure,
  type ScriptWorld
} from './figure-script';

// Two frames: 10 wide with the hot spot at (2, 8), and 12 wide at (4, 8).
const FRAMES = [
  { height: 10, hot_x: 2, hot_y: 8, width: 10 },
  { height: 10, hot_x: 4, hot_y: 8, width: 12 }
];

const world = (
  script: number[],
  over: Partial<ScriptWorld> = {}
): ScriptWorld => ({
  frames: () => FRAMES,
  laggardLine: -1000,
  line1: 1000,
  line2: 1000,
  random: () => 0,
  script: () => script,
  ...over
});

describe('a figure script', () => {
  test('a new figure stands with its first frame hot spot on the point', () => {
    const figure = newFigure(world([0]), 0, 0, 50, 165, 150, 7);
    expect([figure.x, figure.y, figure.frame]).toEqual([48, 157, 0]);
  });

  test('steps right with 0x40, then shows a frame keeping the hot spot still', () => {
    // Entry 2: 0x43 (3 right), 0x01 (frame 1).
    const w = world([0x00, 0x00, 0x43, 0x01]);
    const figure = startScript(newFigure(w, 0, 0, 50, 165, 150, 7), 2);
    const after = stepFigure(figure, w, 100);
    // 48 + 3, then the hot spot moves from 2 to 4.
    expect([after.x, after.frame, after.pc]).toEqual([49, 1, 3]);
    // It waits its delay of 10 vertical blanks.
    expect(after.next).toBe(110);
  });

  test('mirrored, 0x40 steps left and the anchor is measured from the right', () => {
    // Byte 0 is the first frame; from entry 1: 0xe1 faces left, 0x43,
    // frame 1.
    const w = world([0x00, 0xe1, 0x43, 0x01]);
    const after = stepFigure({ ...newFigure(w, 0, 1, 50, 165, 150, 7) }, w, 0);
    // 48 - 3, then (10 - 2) - (12 - 4) = 0.
    expect([after.flipped, after.x, after.frame]).toEqual([true, 45, 1]);
  });

  test('jumps, calls and returns', () => {
    // From entry 1: a1 05 (call 5), 3: frame 1; 5: 0x43, return.
    const script = [0x00, 0xa1, 0x05, 0x01, 0x00, 0x43, 0xbf];
    const w = world(script);
    const figure = newFigure(w, 0, 1, 50, 165, 150, 7);
    // Call 5 (step 3 right), return to 3, frame 1.
    const after = stepFigure(figure, w, 0);
    expect([after.x, after.frame, after.returns]).toEqual([49, 1, []]);
  });

  test('a wait of 0 stops the figure for good', () => {
    const w = world([0x00, 0x60]);
    expect(stepFigure(newFigure(w, 0, 1, 0, 0, 150, 7), w, 0).next).toBe(
      STOPPED
    );
  });

  test.each([
    {
      flipped: false,
      frml: 4,
      launchX: 61,
      launchY: 177,
      line: 'line1',
      value: 61
    },
    {
      flipped: true,
      frml: 4,
      launchX: 51,
      launchY: 177,
      line: 'line2',
      value: 21
    },
    {
      flipped: false,
      frml: 12,
      launchX: 61,
      launchY: 207,
      line: 'line1',
      value: 61
    },
    {
      flipped: true,
      frml: 12,
      launchX: 51,
      launchY: 177,
      line: 'line2',
      value: 21
    }
  ])('event 0x10 launches from set $frml, flipped $flipped', scenario => {
    const casts: { flash: Figure; line: string; x: number }[] = [];
    const w = world([0, 0x43, 0x90, 0], {
      castSpell: (flash, line, x) => casts.push({ flash, line, x })
    });
    // The event uses movement and facing from this interpretation, even
    // before the caster's next frame commits its position.
    const caster = newFigure(w, scenario.frml, 1, 50, 165, 150, 7);
    // Make both cases move right by three pixels before the event.
    w.script = frml =>
      frml === 18 ? [0] : [0, scenario.flipped ? 0x23 : 0x43, 0x90, 0];
    const after = stepFigure({ ...caster, flipped: scenario.flipped }, w, 100);
    expect(after.spells).toBe(1);
    expect(casts).toHaveLength(1);
    expect(casts[0]).toMatchObject({
      flash: {
        depth: 150,
        flipped: !scenario.flipped,
        frame: 0,
        frml: 18,
        owner: 0,
        pc: (scenario.flipped ? 0x17 : 0x0a) - 1,
        x: scenario.launchX - FRAMES[0]!.hot_x,
        y: scenario.launchY - FRAMES[0]!.hot_y
      },
      line: scenario.line,
      x: scenario.value
    });
    expect(caster.spells).toBeUndefined();
  });
});
