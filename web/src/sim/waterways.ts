// The rivers and Crossings of the vector geography (ADR-0006), static
// data the sim loads alongside the Terrain Regions and never saves. A
// river is the line down its middle; a Crossing is a spot where a road
// crosses a river, named as a Place or not (ADR-0008). Crossing movement
// routes Forces over them (docs/spec/crossing-movement.md).

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

// How far along ab, from 0 at a to 1 at b, it meets segment cd, or
// null when they do not meet. A touch along a shared line counts at
// the nearer of c and d.
const meetsAt = (a: Point, b: Point, c: Point, d: Point): number | null => {
  if (!segmentsMeet(a, b, c, d)) {
    return null;
  }
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const cross = rx * sy - ry * sx;
  const length2 = rx * rx + ry * ry;
  if (cross !== 0) {
    return ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
  }
  if (length2 === 0) {
    return 0;
  }
  const along = (p: Point): number =>
    Math.min(1, Math.max(0, ((p.x - a.x) * rx + (p.y - a.y) * ry) / length2));
  return Math.min(along(c), along(d));
};

// The river the straight way from a to b meets first, from a's end,
// as its index in `rivers`, or null when it meets none. Rivers in
// `skip` are passed over. Ties go to the earlier river.
export const firstRiverMet = (
  waterways: Waterways,
  a: Point,
  b: Point,
  skip: readonly number[] = []
): number | null => {
  let first: number | null = null;
  let firstAt = Infinity;
  waterways.rivers.forEach((river, index) => {
    if (skip.includes(index)) {
      return;
    }
    for (let i = 1; i < river.length; i++) {
      const at = meetsAt(a, b, river[i - 1]!, river[i]!);
      if (at !== null && at < firstAt) {
        first = index;
        firstAt = at;
      }
    }
  });
  return first;
};

// Whether the straight way from a to b meets a river's line.
export const crossesRiver = (
  waterways: Waterways,
  a: Point,
  b: Point
): boolean => firstRiverMet(waterways, a, b) !== null;

// The distance from a point to segment ab.
export const distanceToSegment = (p: Point, a: Point, b: Point): number => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const length2 = rx * rx + ry * ry;
  const t =
    length2 === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((p.x - a.x) * rx + (p.y - a.y) * ry) / length2)
        );
  return Math.hypot(p.x - (a.x + t * rx), p.y - (a.y + t * ry));
};

// Whether a river's line passes within `reach` map pixels of a point
// on each axis, through the square of side 2 * reach around it.
export const riverWithinSquare = (
  river: Point[],
  p: Point,
  reach: number
): boolean =>
  river.some((b, i) => {
    if (i === 0) {
      return false;
    }
    // Clip segment ab to the square (Liang-Barsky).
    const a = river[i - 1]!;
    let t0 = 0;
    let t1 = 1;
    const clip = (step: number, room: number): boolean => {
      if (step === 0) {
        return room >= 0;
      }
      const t = room / step;
      if (step < 0) {
        t0 = Math.max(t0, t);
      } else {
        t1 = Math.min(t1, t);
      }
      return t0 <= t1;
    };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return (
      clip(-dx, a.x - (p.x - reach)) &&
      clip(dx, p.x + reach - a.x) &&
      clip(-dy, a.y - (p.y - reach)) &&
      clip(dy, p.y + reach - a.y)
    );
  });

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
