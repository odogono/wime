import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { stepStage, type Stage } from './animation-level';
import {
  STOPPED,
  newFigure,
  stepFigure,
  type Figure,
  type FrameRecord,
  type ScriptWorld
} from './figure-script';

// Full script playback uses exported assets, as in the figure-colour tests.
// CI still exercises event placement in figure-script.test.ts and stage
// cleanup below without the original's data.
const tablesPath = new URL(
  '../../public/assets/animation/tables.json',
  import.meta.url
);
const figuresPath = new URL(
  '../../public/assets/animation/figures.json',
  import.meta.url
);
const exported = existsSync(tablesPath) && existsSync(figuresPath);
const tables: { figure_scripts: number[][] } = exported
  ? JSON.parse(readFileSync(tablesPath, 'utf8'))
  : { figure_scripts: [] };
const sets: { figures: { frames: FrameRecord[]; id: number }[] } = exported
  ? JSON.parse(readFileSync(figuresPath, 'utf8'))
  : { figures: [] };
const world: ScriptWorld = {
  fighting: true,
  frames: id => sets.figures.find(set => set.id === id)?.frames ?? [],
  laggardLine: 0,
  line1: 80,
  line2: 240,
  random: () => 0,
  script: id => tables.figure_scripts[id] ?? []
};

describe.skipIf(!exported)('spell flashes with the exported scripts', () => {
  test.each([
    {
      burstX: 254,
      flipped: false,
      launchX: 137,
      travelX: [137, 150, 155, 159],
      x: 80
    },
    {
      burstX: 67,
      flipped: true,
      launchX: 249,
      travelX: [249, 243, 237, 231],
      x: 250
    }
  ])('matches the original capture with caster flipped $flipped', scenario => {
    // observed:animation-level-spell-flash; the debugger advances one
    // script update at a time (docs/re/animation-level-reference.md).
    const casts: Figure[] = [];
    const w: ScriptWorld = {
      ...world,
      castSpell: (flash, line, x) => {
        casts.push(flash);
        w[line] = x;
      },
      line1: 70,
      line2: 250
    };
    stepFigure(
      {
        ...newFigure(w, 4, 0x25, 0, 0, 150, 1),
        flipped: scenario.flipped,
        frame: 11,
        x: scenario.x,
        y: 108
      },
      w,
      0
    );
    expect(casts).toHaveLength(1);
    let flash = casts[0]!;
    expect(flash).toMatchObject({
      flipped: !scenario.flipped,
      frame: 0,
      x: scenario.launchX,
      y: 126
    });
    const travelX: number[] = [];
    for (let update = 0; update < 100 && flash.frame !== 4; update++) {
      flash = stepFigure(flash, w, update);
      travelX.push(flash.x);
    }
    expect(travelX.slice(0, 4)).toEqual([...scenario.travelX]);
    expect(flash).toMatchObject({ frame: 4, x: scenario.burstX, y: 120 });
    expect(stepFigure(flash, w, 100).x).toBe(350);
  });

  test.each(
    [4, 8, 12].flatMap(frml => [0x1a, 0x2a].map(entry => ({ entry, frml })))
  )(
    'set $frml attack $entry casts in both directions and bursts at the opposite line',
    ({ entry, frml }) => {
      for (const flipped of [false, true]) {
        let stage: Stage = {
          figures: [
            {
              ...newFigure(world, frml, entry, flipped ? 240 : 80, 165, 150, 1),
              flipped
            }
          ],
          party: 1
        };
        const frames = new Set<number>();
        let burstX = 0;
        let launchX: number | undefined;
        for (let vbl = 0; vbl < 1500; vbl++) {
          stage = stepStage(stage, world, vbl);
          const flash = stage.figures[1];
          if (!flash) {
            continue;
          }
          expect(stage.figures).toHaveLength(2);
          expect(flash.flipped).toBe(!flipped);
          expect(flash.depth).toBe(150);
          if (launchX === undefined) {
            launchX = flash.x;
            // Freeze the caster once the cast has run, leaving its flash
            // to travel on its own through the stage's normal updates.
            stage.figures[0] = { ...stage.figures[0]!, next: STOPPED };
          }
          frames.add(flash.frame);
          if (flash.frame === 4 && flash.x < 320) {
            burstX = flash.x;
          }
          if (flash.x > 320) {
            break;
          }
        }
        expect(stage.figures[0]!.spells).toBe(1);
        expect(frames).toEqual(new Set([1, 2, 3, 0, 4]));
        expect(stage.figures[1]!.x).toBe(350);
        expect(flipped ? burstX < launchX! : burstX > launchX!).toBe(true);
        // Changing to the burst's hot spot shifts its top left by at most
        // the frame widths; the burst stays at the opposite battle line.
        expect(
          Math.abs(burstX - (flipped ? world.line1 : world.line2))
        ).toBeLessThan(30);
      }
    }
  );
});

test('a cast removes spent flashes without changing combatant indices or the old stage', () => {
  const w: ScriptWorld = {
    ...world,
    frames: () => [{ height: 5, hot_x: 1, hot_y: 2, width: 19 }],
    script: id => (id === 18 ? [0, 0x60] : [0, 0x90, 0x60])
  };
  const caster = newFigure(w, 4, 1, 50, 165, 150, 1);
  const flash = newFigure(w, 18, 1, 100, 130, 150, 0);
  const stage: Stage = {
    figures: [
      caster,
      { ...caster, next: STOPPED, owner: 2 },
      { ...flash, next: STOPPED, x: 350 },
      { ...flash, next: STOPPED, x: 320 }
    ],
    party: 2
  };
  const before = structuredClone(stage);
  const after = stepStage(stage, w, 100);
  expect(after.figures).toHaveLength(4);
  expect(after.figures.map(figure => figure.owner)).toEqual([1, 2, 0, 0]);
  expect(after.figures[2]!.x).toBe(320);
  expect(after.figures[3]).toMatchObject({ frame: 0, frml: 18, pc: 0x0a });
  expect(after.lines).toEqual({ line1: 68, line2: 240 });
  expect(stage).toEqual(before);
});
