import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

import { chooseCrossing } from './crossing-movement';
import { loadWaterways } from './waterways';

// A river down x = 100 with Crossings at y = 100, 300 and 600.
const waterways = loadWaterways({
  crossings: [{ at: [100, 300] }, { at: [100, 100] }, { at: [104, 600] }],
  rivers: [
    [
      [100, 0],
      [100, 1000]
    ]
  ]
});

const leg = (waypoint: { x: number; y: number } | null) => ({
  destination: { x: 200, y: 100 },
  rivers: waypoint ? [0] : [],
  riversCrossed: [],
  waypoint
});

describe('chooseCrossing', () => {
  test('takes the Crossing with the shortest way through, on its tile origin', () => {
    expect(
      chooseCrossing(waterways, { x: 0, y: 100 }, { x: 200, y: 100 }, [])
    ).toEqual(leg({ x: 96, y: 96 }));
  });

  test('takes nothing when the way meets no river, or only rivers crossed', () => {
    expect(
      chooseCrossing(waterways, { x: 0, y: 100 }, { x: 50, y: 100 }, [])
    ).toEqual({ ...leg(null), destination: { x: 50, y: 100 } });
    expect(
      chooseCrossing(waterways, { x: 0, y: 100 }, { x: 200, y: 100 }, [0])
    ).toEqual({ ...leg(null), riversCrossed: [0] });
  });

  test('reaches a Crossing by the detour ratio or by lying near the way', () => {
    // From (0, 250) to (200, 250): the Crossing at y = 300 is 50 off
    // the way, within CROSSING_NEAR_LINE.
    expect(
      chooseCrossing(waterways, { x: 0, y: 250 }, { x: 200, y: 250 }, [])
        .waypoint
    ).toEqual({ x: 96, y: 288 });
    // From (0, 450) to (200, 450): y = 300 and y = 600 are 150 off the
    // way and lengthen it past 1.5 times.
    expect(
      chooseCrossing(waterways, { x: 0, y: 450 }, { x: 200, y: 450 }, [])
        .waypoint
    ).toBeNull();
    // A longer way stays within the ratio: 2 x hypot(500, 150) is
    // under 1.5 x 1000.
    expect(
      chooseCrossing(waterways, { x: -400, y: 450 }, { x: 600, y: 450 }, [])
        .waypoint
    ).toEqual({ x: 96, y: 288 });
  });

  test('ties go to the earlier Crossing', () => {
    const tied = loadWaterways({
      crossings: [{ at: [100, 200] }, { at: [100, 0] }],
      rivers: [
        [
          [100, -500],
          [100, 500]
        ]
      ]
    });
    expect(
      chooseCrossing(tied, { x: 0, y: 100 }, { x: 200, y: 100 }, []).waypoint
    ).toEqual({ x: 96, y: 192 });
  });
});

const WATERWAYS = new URL(
  '../../public/assets/geography/waterways.json',
  import.meta.url
).pathname;

// Called only inside the skipped block, so CI never reads the assets.
const real = (): ReturnType<typeof loadWaterways> =>
  loadWaterways(JSON.parse(readFileSync(WATERWAYS, 'utf8')));

describe.skipIf(!existsSync(WATERWAYS))('Crossings on the real map', () => {
  test("Frodo's leg from Bree to Rivendell crosses at the Last Bridge, then the Ford of Bruinen", () => {
    const waterways = real();
    const rivendell = { x: 1216, y: 384 };
    const bridge = chooseCrossing(waterways, { x: 784, y: 384 }, rivendell, []);
    expect(bridge.waypoint).toEqual({ x: 1072, y: 400 });
    const ford = chooseCrossing(
      waterways,
      bridge.waypoint!,
      rivendell,
      bridge.rivers
    );
    // The Ford of Bruinen's tile, where the Nazgûl sleep.
    expect(ford.waypoint).toEqual({ x: 1200, y: 400 });
    // It sits on all three lines meeting at the Bruinen's confluence,
    // so crossing there leaves no Bruinen to cross.
    expect(ford.rivers.length).toBe(3);
    expect(
      chooseCrossing(waterways, ford.waypoint!, rivendell, [
        ...ford.riversCrossed,
        ...ford.rivers
      ]).waypoint
    ).toBeNull();
  });

  test('no Crossing is in reach of the Entwash between East Emnet and Edoras', () => {
    // The waterways hold no Crossing on the Entwash, so Éomer's leg
    // takes no waypoint and he moves as under Classic movement.
    expect(
      chooseCrossing(real(), { x: 1360, y: 960 }, { x: 1248, y: 992 }, [])
        .waypoint
    ).toBeNull();
  });
});
