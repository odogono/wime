// The rivers and Crossings of the vector geography (ADR-0006), static
// data the sim loads alongside the Terrain Regions and never saves. A
// river is the line down its middle; a Crossing is a spot where a road
// crosses a river, named as a Place or not (ADR-0008). Movement does not
// read them yet; routing a Force to a Crossing will (#324).

import type { Point } from './starting-state';

export interface Crossing {
  // The Place the Crossing is, such as SARN FORD, or null for an
  // unnamed one.
  place: string | null;
  x: number;
  y: number;
}

export interface Waterways {
  crossings: Crossing[];
  // Each river as a line of map pixel points.
  rivers: Point[][];
}

// Whether segments ab and cd cross or touch.
const segmentsMeet = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const side = (p: Point, q: Point, r: Point): number =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const within = (p: Point, q: Point, r: Point): boolean =>
    Math.min(p.x, q.x) <= r.x &&
    r.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= r.y &&
    r.y <= Math.max(p.y, q.y);
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) {
    return true;
  }
  return (
    (d1 === 0 && within(c, d, a)) ||
    (d2 === 0 && within(c, d, b)) ||
    (d3 === 0 && within(a, b, c)) ||
    (d4 === 0 && within(a, b, d))
  );
};

// Whether the straight way from a to b meets a river's line.
export const crossesRiver = (
  waterways: Waterways,
  a: Point,
  b: Point
): boolean =>
  waterways.rivers.some(river =>
    river.some((p, i) => i > 0 && segmentsMeet(a, b, river[i - 1]!, p))
  );

// The Crossings within `reach` map pixels of a point, nearest first.
export const crossingsNear = (
  waterways: Waterways,
  point: Point,
  reach: number
): Crossing[] =>
  waterways.crossings
    .map(c => ({ c, d: Math.hypot(c.x - point.x, c.y - point.y) }))
    .filter(({ d }) => d <= reach)
    .sort((p, q) => p.d - q.d)
    .map(({ c }) => c);

const fail = (what: string): never => {
  throw new Error(`Not waterways: ${what}`);
};

const isPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(v => typeof v === 'number');

// Parse waterways.json, as build-geography writes it.
export const loadWaterways = (json: unknown): Waterways => {
  const data = json as Partial<{ crossings: unknown; rivers: unknown }> | null;
  if (!Array.isArray(data?.rivers) || !Array.isArray(data.crossings)) {
    return fail('rivers or crossings is not an array');
  }
  return {
    crossings: data.crossings.map(
      (c: Partial<{ at: unknown; place: unknown }>, i) =>
        isPair(c?.at)
          ? {
              place: typeof c.place === 'string' ? c.place : null,
              x: c.at[0],
              y: c.at[1]
            }
          : fail(`crossings[${i}]`)
    ),
    rivers: data.rivers.map((line: unknown, i) =>
      Array.isArray(line) && line.length >= 2 && line.every(isPair)
        ? line.map(([x, y]) => ({ x, y }))
        : fail(`rivers[${i}]`)
    )
  };
};
