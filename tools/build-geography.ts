#!/usr/bin/env bun
// Trace the vector geography of the map from the exported Campaign Level
// tiles, apply the committed patches and compile the bundle the Atlas
// renderer loads (ADR-0006).
//
//   bun tools/build-geography.ts
//
// Reads web/public/assets/ (run `bun run export:web` first) and writes
// web/public/assets/geography/: source.geojson, the traced and patched
// geography, and bundle.bin, the compiled runtime form. Both are
// regenerated on demand and never committed (ADR-0003); only the patches
// in geography/patches/ are.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import earcut from 'earcut';
import { PNG } from 'pngjs';

export type Point = [number, number];
export type Ring = Point[];

// The kinds of ground a Terrain Region can have. The sim's passability
// comes from the tile's terrain percentage; the kind only styles it.
export const REGION_KINDS = [
  'water',
  'plain',
  'forest',
  'hill',
  'mountain'
] as const;
export type RegionKind = (typeof REGION_KINDS)[number];

export const SYMBOL_KINDS = [
  'tree',
  'peak',
  'hill',
  'marsh',
  'bridge',
  'ford'
] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];

// Line styles in the bundle: the ink edge drawn along a region's border.
export const LINE_STYLES = [
  'coast',
  'forest',
  'mountain',
  'river',
  'road'
] as const;

const TILE = 16;

// ---------------------------------------------------------------------------
// Tracing a label grid into regions whose shared borders are one arc each.

export interface TracedRegion {
  // The first cell of the region in row order, a stable identity for as
  // long as the source grid does not change.
  first: number;
  // The label of the region's cells.
  label: number;
  // Outer rings and holes; outer rings are first in each polygon.
  polygons: Ring[][];
}

type Arc = { left: number; points: Point[]; right: number };

// Every border between two different labels, cut into arcs that run
// between junctions (vertices where three or more labels meet, or where
// a region touches itself diagonally). Each arc is shared by the two
// regions either side of it, so smoothing an arc once smooths both
// borders the same way, leaving no gaps or overlaps. Cells outside the
// grid have component -1.
// Undirected edge lookup so each edge is walked once.
const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

export const traceArcs = (
  components: Int32Array,
  width: number,
  height: number
): Arc[] => {
  const cell = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height
      ? -1
      : components[y * width + x]!;
  const stride = width + 1;
  const vertex = (x: number, y: number): number => y * stride + x;
  // Directed boundary edges, keyed by start vertex, with the component on
  // their left (walking with the region on the left, y down).
  const out = new Map<number, { left: number; right: number; to: number }[]>();
  const add = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    left: number,
    right: number
  ): void => {
    const a = vertex(ax, ay);
    let list = out.get(a);
    if (!list) {
      list = [];
      out.set(a, list);
    }
    list.push({ left, right, to: vertex(bx, by) });
  };
  // One undirected edge per border, oriented so `left` is on its left.
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x < width; x++) {
      const above = cell(x, y - 1);
      const below = cell(x, y);
      if (above !== below) {
        // Walking +x with y down, the left hand points to -y (above).
        add(x, y, x + 1, y, above, below);
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x <= width; x++) {
      const before = cell(x - 1, y);
      const after = cell(x, y);
      if (before !== after) {
        // Walking +y with y down, the left hand points to +x (after).
        add(x, y, x, y + 1, after, before);
      }
    }
  }
  const isJunction = (v: number): boolean => {
    const x = v % stride;
    const y = Math.floor(v / stride);
    const around = [
      cell(x - 1, y - 1),
      cell(x, y - 1),
      cell(x - 1, y),
      cell(x, y)
    ];
    const distinct = new Set(around).size;
    if (distinct >= 3) {
      return true;
    }
    // Two labels meeting diagonally: a checkerboard pinch.
    return distinct === 2 && around[0] === around[3] && around[1] === around[2];
  };
  const edges = new Map<
    string,
    { a: number; b: number; left: number; right: number }
  >();
  for (const [a, list] of out) {
    for (const e of list) {
      edges.set(edgeKey(a, e.to), { a, b: e.to, left: e.left, right: e.right });
    }
  }
  const incident = new Map<number, string[]>();
  for (const [key, e] of edges) {
    for (const v of [e.a, e.b]) {
      let list = incident.get(v);
      if (!list) {
        list = [];
        incident.set(v, list);
      }
      list.push(key);
    }
  }
  const toPoint = (v: number): Point => [v % stride, Math.floor(v / stride)];
  const used = new Set<string>();
  const arcs: Arc[] = [];
  const walk = (start: number, firstKey: string): void => {
    const first = edges.get(firstKey)!;
    // Orient the arc along the first edge's direction from `start`.
    const forward = first.a === start;
    const left = forward ? first.left : first.right;
    const right = forward ? first.right : first.left;
    const points: Point[] = [toPoint(start)];
    let here = start;
    let key = firstKey;
    for (;;) {
      used.add(key);
      const e = edges.get(key)!;
      here = e.a === here ? e.b : e.a;
      points.push(toPoint(here));
      if (here === start || isJunction(here)) {
        break;
      }
      // A non-junction vertex has exactly two border edges with the same
      // pair of labels.
      const next = incident.get(here)!.find(k => !used.has(k));
      if (!next) {
        break;
      }
      key = next;
    }
    arcs.push({ left, points, right });
  };
  const junctions = [...incident.keys()]
    .filter(isJunction)
    .sort((a, b) => a - b);
  for (const v of junctions) {
    for (const key of incident.get(v)!) {
      if (!used.has(key)) {
        walk(v, key);
      }
    }
  }
  // What is left are closed loops with no junction; start each at its
  // lowest vertex so the trace is the same on every run.
  for (const key of [...edges.keys()].sort()) {
    if (!used.has(key)) {
      const e = edges.get(key)!;
      walk(Math.min(e.a, e.b), key);
    }
  }
  return arcs;
};

// Label each 4-connected run of equal labels as its own component.
export const components = (
  labels: Int32Array,
  width: number,
  height: number
): { component: Int32Array; first: number[]; label: number[] } => {
  const component = new Int32Array(labels.length).fill(-1);
  const first: number[] = [];
  const label: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < labels.length; start++) {
    if (component[start] !== -1) {
      continue;
    }
    const id = first.length;
    first.push(start);
    label.push(labels[start]!);
    component[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % width;
      const y = Math.floor(i / width);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        const j = ny * width + nx;
        if (component[j] === -1 && labels[j] === labels[i]) {
          component[j] = id;
          stack.push(j);
        }
      }
    }
  }
  return { component, first, label };
};

export const signedArea = (ring: Ring): number => {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i]!;
    const [bx, by] = ring[(i + 1) % ring.length]!;
    area += ax * by - bx * ay;
  }
  return area / 2;
};

export const pointInRing = ([x, y]: Point, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

// Chain the arcs that border each component into closed rings and group
// them into polygons. `shape` turns an arc's grid points into the drawn
// line, with its end points kept so neighbouring arcs still meet.
export const assembleRegions = (
  arcs: Arc[],
  firsts: number[],
  labels: number[],
  shape: (points: Point[], edge: boolean) => Point[]
): TracedRegion[] => {
  // Arcs along the map's edge stay straight, so smoothing never cuts the
  // map's corners off.
  const shaped = arcs.map(arc => ({
    ...arc,
    points: shape(arc.points, arc.left < 0 || arc.right < 0)
  }));
  const byComponent = new Map<number, Point[][]>();
  const push = (component: number, points: Point[]): void => {
    if (component < 0) {
      return;
    }
    let list = byComponent.get(component);
    if (!list) {
      list = [];
      byComponent.set(component, list);
    }
    list.push(points);
  };
  for (const arc of shaped) {
    push(arc.left, arc.points);
    push(arc.right, [...arc.points].reverse());
  }
  const key = ([x, y]: Point): string => `${x},${y}`;
  const regions: TracedRegion[] = [];
  for (const [component, pieces] of [...byComponent].sort(
    (a, b) => a[0] - b[0]
  )) {
    const starts = new Map<string, number[]>();
    pieces.forEach((piece, i) => {
      const k = key(piece[0]!);
      starts.set(k, [...(starts.get(k) ?? []), i]);
    });
    const used = new Set<number>();
    const rings: Ring[] = [];
    for (let i = 0; i < pieces.length; i++) {
      if (used.has(i)) {
        continue;
      }
      const ring: Point[] = [];
      let at = i;
      for (;;) {
        used.add(at);
        const piece = pieces[at]!;
        ring.push(...piece.slice(0, -1));
        const end = piece.at(-1)!;
        const options = (starts.get(key(end)) ?? []).filter(j => !used.has(j));
        if (!options.length) {
          break;
        }
        // At a pinch, take the sharpest left turn so the region stays on
        // the left and its rings stay simple.
        const prev = piece.at(-2)!;
        const heading = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
        const turn = (j: number): number => {
          const next = pieces[j]![1]!;
          const angle = Math.atan2(next[1] - end[1], next[0] - end[0]);
          let delta = angle - heading;
          while (delta <= -Math.PI) {
            delta += 2 * Math.PI;
          }
          while (delta > Math.PI) {
            delta -= 2 * Math.PI;
          }
          // Left is negative with y down; prefer the most negative turn.
          return delta;
        };
        at = options.sort((a, b) => turn(a) - turn(b))[0]!;
      }
      if (ring.length >= 3) {
        rings.push(ring);
      }
    }
    // With the region on the left and y down, outer rings have negative
    // signed area and holes positive.
    const outers = rings.filter(r => signedArea(r) < 0);
    const holes = rings.filter(r => signedArea(r) >= 0);
    const polygons: Ring[][] = outers.map(r => [r]);
    for (const hole of holes) {
      const owner =
        polygons.find(p => pointInRing(hole[0]!, p[0]!)) ?? polygons[0];
      owner?.push(hole);
    }
    regions.push({
      first: firsts[component]!,
      label: labels[component]!,
      polygons
    });
  }
  return regions;
};

// ---------------------------------------------------------------------------
// Shaping lines.

const segmentDistance = (p: Point, a: Point, b: Point): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)
    )
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

// Douglas–Peucker with both end points kept.
export const simplify = (points: Point[], epsilon: number): Point[] => {
  if (points.length < 3) {
    return points;
  }
  let far = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = segmentDistance(points[i]!, points[0]!, points.at(-1)!);
    if (d > far) {
      far = d;
      index = i;
    }
  }
  if (far <= epsilon) {
    return [points[0]!, points.at(-1)!];
  }
  return [
    ...simplify(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(index), epsilon)
  ];
};

// Chaikin corner cutting with both end points kept.
export const smooth = (points: Point[], rounds: number): Point[] => {
  let line = points;
  for (let r = 0; r < rounds && line.length > 2; r++) {
    const next: Point[] = [line[0]!];
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i]!;
      const [bx, by] = line[i + 1]!;
      if (i > 0) {
        next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      }
      if (i < line.length - 2) {
        next.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
    }
    next.push(line.at(-1)!);
    line = next;
  }
  return line;
};

// A closed arc (start equals end) is simplified from a midpoint too, so
// the loop does not keep a needless corner at its start.
const shapeWith =
  (scale: number, epsilon: number, rounds: number) =>
  (points: Point[], edge: boolean): Point[] => {
    const scaled = points.map(([x, y]): Point => [x * scale, y * scale]);
    if (edge) {
      return simplify(scaled, 0);
    }
    const closed =
      scaled.length > 3 &&
      scaled[0]![0] === scaled.at(-1)![0] &&
      scaled[0]![1] === scaled.at(-1)![1];
    if (!closed) {
      return smooth(simplify(scaled, epsilon), rounds);
    }
    const mid = Math.floor(scaled.length / 2);
    const a = smooth(simplify(scaled.slice(0, mid + 1), epsilon), rounds);
    const b = smooth(simplify(scaled.slice(mid), epsilon), rounds);
    return [...a, ...b.slice(1)];
  };

// ---------------------------------------------------------------------------
// The source geography.

export interface GeographyFeature {
  geometry:
    | { coordinates: Ring[][]; type: 'MultiPolygon' }
    | { coordinates: Point; type: 'Point' }
    | { coordinates: Point[]; type: 'LineString' };
  properties: Record<string, unknown> & { id: string; layer: string };
  type: 'Feature';
}

export interface Geography {
  // Map pixels, y down, not RFC 7946 longitude and latitude (ADR-0006).
  bounds: [number, number, number, number];
  features: GeographyFeature[];
  type: 'FeatureCollection';
}

interface Tilemap {
  height: number;
  indices: number[];
  width: number;
}

interface SourceData {
  atlas: PNG;
  places: {
    name: string;
    position: { x: number; y: number };
    tile_kind: string | null;
  }[];
  strongholds: Set<string>;
  terrainByTile: number[];
  tilemap: Tilemap;
}

const rgb = (png: PNG, x: number, y: number): number => {
  const i = (y * png.width + x) * 4;
  return (png.data[i]! << 16) | (png.data[i + 1]! << 8) | png.data[i + 2]!;
};

const WATER_COLOURS = new Set([0x55_88_ff, 0x88_bb_ff]);
// Marshes are a speckle of the light water colour with no deep water.
const SHALLOW_COLOURS = new Set([0x88_bb_ff]);
const DEEP_COLOURS = new Set([0x55_88_ff]);
const MARSH_DENSITY = 0.18;
const MARSH_MAX_DEEP = 0.08;
const FOREST_COLOURS = new Set([0x22_44_11, 0x33_66_11]);
const ROCK_COLOURS = new Set([0x88_88_88, 0x77_55_55]);
const HILL_COLOURS = new Set([0xee_aa_88]);
// Mountains are drawn with grey rock; hills with sandy earth and brown
// shadow. The sandy colour alone, in a dotted line, is a road.
const GREY_COLOURS = new Set([0x88_88_88]);
const DOWNS_COLOURS = new Set([0xee_aa_88, 0x77_55_55]);
const ROAD_COLOUR = 0xee_aa_88;

// The colour of a map pixel, read through the tilemap.
const pixelReader = (
  source: SourceData
): ((x: number, y: number) => number) => {
  const { atlas, tilemap } = source;
  const columns = atlas.width / TILE;
  return (x, y) => {
    const tile =
      tilemap.indices[
        Math.floor(y / TILE) * tilemap.width + Math.floor(x / TILE)
      ]!;
    return rgb(
      atlas,
      (tile % columns) * TILE + (x % TILE),
      Math.floor(tile / columns) * TILE + (y % TILE)
    );
  };
};

// The kind of ground a tile shows. Terrain 5 is the sea and lakes
// (finding:movement-terrain-percent-scales-pace); the rest is read from
// the tile's colours.
export const tileKinds = (
  atlas: PNG,
  terrainByTile: number[]
): RegionKind[] => {
  const kinds: RegionKind[] = [];
  const columns = atlas.width / TILE;
  for (let id = 0; id < terrainByTile.length; id++) {
    let forest = 0;
    let rock = 0;
    let hill = 0;
    const ox = (id % columns) * TILE;
    const oy = Math.floor(id / columns) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const c = rgb(atlas, ox + x, oy + y);
        forest += Number(FOREST_COLOURS.has(c));
        rock += Number(ROCK_COLOURS.has(c));
        hill += Number(HILL_COLOURS.has(c));
      }
    }
    const terrain = terrainByTile[id] ?? 100;
    kinds.push(
      terrain <= 5
        ? 'water'
        : rock >= 100 || terrain <= 15
          ? 'mountain'
          : forest >= 70
            ? 'forest'
            : hill >= 60
              ? 'hill'
              : 'plain'
    );
  }
  return kinds;
};

const mapSize = (tilemap: Tilemap): [number, number] => [
  tilemap.width * TILE,
  tilemap.height * TILE
];

// The Terrain Regions: tiles grouped by kind of ground and terrain
// percentage, so each region has one passability.
export const traceTerrainRegions = (
  source: SourceData,
  kinds: RegionKind[]
): GeographyFeature[] => {
  const { terrainByTile, tilemap } = source;
  const { height, width } = tilemap;
  const labels = new Int32Array(width * height);
  for (let i = 0; i < labels.length; i++) {
    const tile = tilemap.indices[i]!;
    labels[i] =
      REGION_KINDS.indexOf(kinds[tile]!) * 1000 + (terrainByTile[tile] ?? 100);
  }
  const c = components(labels, width, height);
  const arcs = traceArcs(c.component, width, height);
  const regions = assembleRegions(
    arcs,
    c.first,
    c.label,
    shapeWith(TILE, 0, 0)
  );
  return regions.map(region => {
    const kind = REGION_KINDS[Math.floor(region.label / 1000)]!;
    const x = region.first % width;
    const y = Math.floor(region.first / width);
    return {
      geometry: { coordinates: region.polygons, type: 'MultiPolygon' },
      properties: {
        id: `region:${x},${y}`,
        kind,
        layer: 'terrain-region',
        terrain: region.label % 1000
      },
      type: 'Feature'
    };
  });
};

// The kinds of ground the map is drawn with: the Terrain Region kinds,
// and rivers, water too narrow to be sea or lake.
export const GROUND_KINDS = [...REGION_KINDS, 'river', 'marsh'] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];

// The drawn ground, traced from the tiles' pixels rather than whole tiles,
// so woods, mountains and coasts keep the shapes the original's artist
// drew instead of the tile grid. Passability stays with the tile-aligned
// Terrain Regions.
export interface Ground {
  features: GeographyFeature[];
  // The kind of each cell, GROUND_KINDS indices, `step` map pixels square.
  kinds: Uint8Array;
  step: number;
  width: number;
}

// How much of a window around each cell must show a kind's colours for
// the cell to be that kind, checked in this order.
const DENSITY: [GroundKind, Set<number>, number][] = [
  ['mountain', GREY_COLOURS, 0.15],
  ['forest', FOREST_COLOURS, 0.28],
  ['hill', DOWNS_COLOURS, 0.35]
];
const WINDOW = 7;
// Specks smaller than this many cells join the ground around them.
const MIN_CELLS = 16;
// Water bodies at least this many cells are sea or lake, smaller rivers.
const MIN_LAKE_CELLS = 4000;

export const traceGround = (source: SourceData): Ground => {
  const STEP = 2;
  const [mapW, mapH] = mapSize(source.tilemap);
  const colourAt = pixelReader(source);
  // Summed-area tables of each colour class, for window densities.
  const stride = mapW + 1;
  const classes = [
    ...DENSITY.map(([, colours]) => colours),
    SHALLOW_COLOURS,
    DEEP_COLOURS
  ];
  const shallow = DENSITY.length;
  const deep = DENSITY.length + 1;
  const tables = classes.map(() => new Int32Array(stride * (mapH + 1)));
  const water = new Uint8Array(mapW * mapH);
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const c = colourAt(x, y);
      water[y * mapW + x] = Number(WATER_COLOURS.has(c));
      classes.forEach((colours, i) => {
        const t = tables[i]!;
        t[(y + 1) * stride + x + 1] =
          Number(colours.has(c)) +
          t[y * stride + x + 1]! +
          t[(y + 1) * stride + x]! -
          t[y * stride + x]!;
      });
    }
  }
  const density = (i: number, cx: number, cy: number): number => {
    const x0 = Math.max(0, cx - WINDOW);
    const y0 = Math.max(0, cy - WINDOW);
    const x1 = Math.min(mapW, cx + WINDOW);
    const y1 = Math.min(mapH, cy + WINDOW);
    const t = tables[i]!;
    const sum =
      t[y1 * stride + x1]! -
      t[y0 * stride + x1]! -
      t[y1 * stride + x0]! +
      t[y0 * stride + x0]!;
    return sum / ((x1 - x0) * (y1 - y0));
  };
  const width = mapW / STEP;
  const height = mapH / STEP;
  const labels = new Int32Array(width * height);
  const plain = GROUND_KINDS.indexOf('plain');
  const wet = GROUND_KINDS.indexOf('water');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x * STEP;
      const py = y * STEP;
      let wetPixels = 0;
      for (let dy = 0; dy < STEP; dy++) {
        for (let dx = 0; dx < STEP; dx++) {
          wetPixels += water[(py + dy) * mapW + px + dx]!;
        }
      }
      let label = plain;
      if (
        density(shallow, px + 1, py + 1) >= MARSH_DENSITY &&
        density(deep, px + 1, py + 1) < MARSH_MAX_DEEP
      ) {
        label = GROUND_KINDS.indexOf('marsh');
      } else if (wetPixels >= 2) {
        label = wet;
      } else {
        const found = DENSITY.findIndex(
          (_, i) => density(i, px + 1, py + 1) >= DENSITY[i]![2]
        );
        if (found !== -1) {
          label = GROUND_KINDS.indexOf(DENSITY[found]![0]);
        }
      }
      labels[y * width + x] = label;
    }
  }
  // Fold specks into the ground around them, so the ink stays clean.
  const speckle = components(labels, width, height);
  const sizes = new Int32Array(speckle.first.length);
  for (const id of speckle.component) {
    sizes[id]!++;
  }
  for (let i = 0; i < labels.length; i++) {
    const id = speckle.component[i]!;
    const limit = labels[i] === wet ? 3 : MIN_CELLS;
    if (sizes[id]! >= limit) {
      continue;
    }
    const x = i % width;
    const y = Math.floor(i / width);
    const votes = new Map<number, number>();
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
      [x - 2, y],
      [x + 2, y],
      [x, y - 2],
      [x, y + 2]
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const j = ny * width + nx;
      if (speckle.component[j] === id) {
        continue;
      }
      votes.set(labels[j]!, (votes.get(labels[j]!) ?? 0) + 1);
    }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0];
    if (best) {
      labels[i] = best[0];
    }
  }
  // Narrow water is a river; big water is sea or lake.
  const pass = components(labels, width, height);
  const waterSizes = new Int32Array(pass.first.length);
  for (const id of pass.component) {
    waterSizes[id]!++;
  }
  const river = GROUND_KINDS.indexOf('river');
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === wet && waterSizes[pass.component[i]!]! < MIN_LAKE_CELLS) {
      labels[i] = river;
    }
  }
  const c = components(labels, width, height);
  const arcs = traceArcs(c.component, width, height);
  const regions = assembleRegions(
    arcs,
    c.first,
    c.label,
    shapeWith(STEP, 1, 1)
  );
  const features: GeographyFeature[] = regions.map(region => {
    const x = (region.first % width) * STEP;
    const y = Math.floor(region.first / width) * STEP;
    return {
      geometry: { coordinates: region.polygons, type: 'MultiPolygon' },
      properties: {
        id: `ground:${x},${y}`,
        kind: GROUND_KINDS[region.label]!,
        layer: 'ground'
      },
      type: 'Feature'
    };
  });
  return { features, kinds: Uint8Array.from(labels), step: STEP, width };
};

// ---------------------------------------------------------------------------
// Roads: the original draws them as dotted lines of sandy pixels. The dots
// are picked out where the sandy colour stands alone (not in the hills'
// earth), joined, thinned to a one-pixel centre line and followed into
// polylines.

// Zhang–Suen thinning, in place, of a 0/1 mask.
export const thin = (mask: Uint8Array, width: number, height: number): void => {
  let candidates: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      candidates.push(i);
    }
  }
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x]!;
  for (let changed = true; changed;) {
    changed = false;
    for (const pass of [0, 1]) {
      const remove: number[] = [];
      for (const i of candidates) {
        if (!mask[i]) {
          continue;
        }
        const x = i % width;
        const y = Math.floor(i / width);
        // Neighbours clockwise from north.
        const n = [
          at(x, y - 1),
          at(x + 1, y - 1),
          at(x + 1, y),
          at(x + 1, y + 1),
          at(x, y + 1),
          at(x - 1, y + 1),
          at(x - 1, y),
          at(x - 1, y - 1)
        ];
        const b = n.reduce((sum, v) => sum + v, 0);
        if (b < 2 || b > 6) {
          continue;
        }
        let a = 0;
        for (let k = 0; k < 8; k++) {
          a += Number(n[k] === 0 && n[(k + 1) % 8] === 1);
        }
        if (a !== 1) {
          continue;
        }
        const [p2, , p4, , p6, , p8] = n;
        if (
          pass === 0
            ? p2! * p4! * p6! === 0 && p4! * p6! * p8! === 0
            : p2! * p4! * p8! === 0 && p2! * p6! * p8! === 0
        ) {
          remove.push(i);
        }
      }
      for (const i of remove) {
        mask[i] = 0;
      }
      changed ||= remove.length > 0;
    }
    candidates = candidates.filter(i => mask[i]);
  }
};

// Follow a one-pixel skeleton into polylines that run between ends and
// junctions.
export const followSkeleton = (
  mask: Uint8Array,
  width: number,
  height: number
): Point[][] => {
  const neighbours = (i: number): number[] => {
    const x = i % width;
    const y = Math.floor(i / width);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (
          (dx || dy) &&
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          mask[ny * width + nx]
        ) {
          out.push(ny * width + nx);
        }
      }
    }
    return out;
  };
  const pixels: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      pixels.push(i);
    }
  }
  const degree = new Map(pixels.map(i => [i, neighbours(i).length]));
  const isNode = (i: number): boolean => degree.get(i) !== 2;
  const walked = new Set<string>();
  const lines: Point[][] = [];
  const walk = (start: number, next: number): void => {
    const line = [start];
    let prev = start;
    let here = next;
    walked.add(edgeKey(prev, here));
    for (;;) {
      line.push(here);
      if (isNode(here) || here === start) {
        break;
      }
      const onward = neighbours(here).find(
        n => n !== prev && !walked.has(edgeKey(here, n))
      );
      if (onward === undefined) {
        break;
      }
      walked.add(edgeKey(here, onward));
      prev = here;
      here = onward;
    }
    lines.push(line.map(i => [i % width, Math.floor(i / width)]));
  };
  for (const i of pixels) {
    if (isNode(i)) {
      for (const n of neighbours(i)) {
        if (!walked.has(edgeKey(i, n))) {
          walk(i, n);
        }
      }
    }
  }
  // Closed loops with no end or junction.
  for (const i of pixels) {
    const n = neighbours(i).find(m => !walked.has(edgeKey(i, m)));
    if (n !== undefined) {
      walk(i, n);
    }
  }
  return lines;
};

const lineLength = (line: Point[]): number =>
  line.reduce(
    (sum, p, i) =>
      i ? sum + Math.hypot(p[0] - line[i - 1]![0], p[1] - line[i - 1]![1]) : 0,
    0
  );

export interface Roads {
  // Map pixels within a few pixels of a road, kept clear of trees.
  clearing: Uint8Array;
  features: GeographyFeature[];
}

export const traceRoads = (source: SourceData): Roads => {
  const [mapW, mapH] = mapSize(source.tilemap);
  const colourAt = pixelReader(source);
  const sandy = new Uint8Array(mapW * mapH);
  const earth = new Uint8Array(mapW * mapH);
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const c = colourAt(x, y);
      sandy[y * mapW + x] = Number(c === ROAD_COLOUR);
      earth[y * mapW + x] = Number(DOWNS_COLOURS.has(c) || GREY_COLOURS.has(c));
    }
  }
  // A road dot is sandy with little earth around it: the hills' sandy
  // pixels sit among their brown shadow.
  const R = 3;
  const dots: number[] = [];
  for (let y = R; y < mapH - R; y++) {
    for (let x = R; x < mapW - R; x++) {
      if (!sandy[y * mapW + x]) {
        continue;
      }
      let around = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          around += earth[(y + dy) * mapW + x + dx]!;
        }
      }
      if (around <= 4) {
        dots.push(y * mapW + x);
      }
    }
  }
  // Join the dots, then thin the joined line to its centre.
  const dilate = (from: number[], radius: number): Uint8Array => {
    const out = new Uint8Array(mapW * mapH);
    for (const i of from) {
      const x = i % mapW;
      const y = Math.floor(i / mapW);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < mapW && ny < mapH) {
            out[ny * mapW + nx] = 1;
          }
        }
      }
    }
    return out;
  };
  const joined = dilate(dots, 2);
  thin(joined, mapW, mapH);
  const lines = followSkeleton(joined, mapW, mapH)
    // Short spurs and stray specks are thinning noise, not roads.
    .filter(line => lineLength(line) >= 10)
    .map(line => smooth(simplify(line, 1.2), 2));
  const features: GeographyFeature[] = lines.map(line => ({
    geometry: { coordinates: line, type: 'LineString' },
    properties: { id: `road:${line[0]![0]},${line[0]![1]}`, layer: 'road' },
    type: 'Feature'
  }));
  return { clearing: dilate(dots, 4), features };
};

// ---------------------------------------------------------------------------
// Crossings: where a road crosses a river or water, a bridge, or a ford
// where the crossing is a named ford (finding:map-sarn-ford-stepping-stones,
// finding:map-fords-of-isen-only-isen-crossing). Each is its own feature,
// with the angle the road crosses at, for the map and for the sim's later
// use (ADR-0006).

// The longest run of water a road may cross and still be a crossing,
// rather than running along a shore.
const MAX_CROSSING = 40;
// Crossings closer than this are one.
const CROSSING_MERGE = 14;
// How near a ford Place a crossing must be to be that ford.
const FORD_REACH = 32;

// Whether a road end, heading out of `from` to `at`, points towards `to`.
const facing = (end: { at: Point; from: Point }, to: Point): boolean =>
  (end.at[0] - end.from[0]) * (to[0] - end.at[0]) +
    (end.at[1] - end.from[1]) * (to[1] - end.at[1]) >
  0;

const isCrossing = (f: { properties: { id: string } }): boolean =>
  f.properties.id.startsWith('crossing:');

export const traceCrossings = (
  source: SourceData,
  ground: Ground,
  roads: GeographyFeature[],
  places: GeographyFeature[]
): GeographyFeature[] => {
  const [mapW, mapH] = mapSize(source.tilemap);
  const water = new Set([
    GROUND_KINDS.indexOf('water'),
    GROUND_KINDS.indexOf('river')
  ]);
  const wetAt = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < mapW &&
    y < mapH &&
    water.has(
      ground.kinds[
        Math.floor(y / ground.step) * ground.width + Math.floor(x / ground.step)
      ]!
    );
  // Each crossing's centre, its road's heading folded into 0 to π, and
  // the width of water it spans.
  const found: { angle: number; span: number; x: number; y: number }[] = [];
  for (const road of roads) {
    const line = road.geometry.coordinates as Point[];
    let run: Point[] = [];
    // Walk the road a pixel at a time, noting each run over water.
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i]!;
      const [bx, by] = line[i + 1]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const p: Point = [ax + (bx - ax) * t, ay + (by - ay) * t];
        if (wetAt(p[0], p[1])) {
          run.push(p);
          continue;
        }
        if (run.length && run.length <= MAX_CROSSING) {
          const [sx, sy] = run[0]!;
          const [ex, ey] = run.at(-1)!;
          found.push({
            angle: (Math.atan2(by - ay, bx - ax) + Math.PI) % Math.PI,
            span: Math.hypot(ex - sx, ey - sy),
            x: (sx + ex) / 2,
            y: (sy + ey) / 2
          });
        }
        run = [];
      }
    }
  }
  // The original stops its road dots at the bank, so most roads end on
  // either side of the water: pair road ends that face each other across
  // it, with only water between.
  const ends = roads.flatMap(road => {
    const line = road.geometry.coordinates as Point[];
    return line.length < 2
      ? []
      : [
          { at: line[0]!, from: line[1]! },
          { at: line.at(-1)!, from: line.at(-2)! }
        ];
  });
  for (const [i, a] of ends.entries()) {
    for (const b of ends.slice(i + 1)) {
      const [ax, ay] = a.at;
      const [bx, by] = b.at;
      const gap = Math.hypot(bx - ax, by - ay);
      if (gap < 3 || gap > MAX_CROSSING) {
        continue;
      }
      // Both ends must point at each other, and the gap must be water.
      if (!facing(a, b.at) || !facing(b, a.at)) {
        continue;
      }
      let wet = 0;
      const steps = Math.ceil(gap);
      for (let k = 1; k < steps; k++) {
        wet += Number(
          wetAt(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps)
        );
      }
      if (wet < steps * 0.4) {
        continue;
      }
      found.push({
        angle: (Math.atan2(by - ay, bx - ax) + Math.PI) % Math.PI,
        span: gap,
        x: (ax + bx) / 2,
        y: (ay + by) / 2
      });
    }
  }
  const crossings: typeof found = [];
  for (const c of found) {
    if (
      !crossings.some(o => Math.hypot(o.x - c.x, o.y - c.y) < CROSSING_MERGE)
    ) {
      crossings.push(c);
    }
  }
  const named = places.filter(p =>
    ['bridge', 'ford'].includes(p.properties.pictogram as string)
  );
  // A named crossing the roads miss sits on the water nearest its Place.
  for (const place of named) {
    const [px, py] = place.geometry.coordinates as Point;
    if (crossings.some(c => Math.hypot(c.x - px, c.y - py) < FORD_REACH)) {
      continue;
    }
    let best: Point | null = null;
    for (let r = 0; r <= 16 && !best; r++) {
      for (let a = 0; a < 16 && !best; a++) {
        const q: Point = [
          px + Math.cos((a / 16) * 2 * Math.PI) * r,
          py + Math.sin((a / 16) * 2 * Math.PI) * r
        ];
        if (wetAt(q[0], q[1])) {
          best = q;
        }
      }
    }
    if (best) {
      crossings.push({ angle: 0, span: 10, x: best[0], y: best[1] });
    }
  }
  // Each named ford is the crossing nearest its Place; the rest are
  // bridges.
  const fordOf = new Map<(typeof crossings)[number], GeographyFeature>();
  for (const place of named.filter(p => p.properties.pictogram === 'ford')) {
    const [px, py] = place.geometry.coordinates as Point;
    const nearest = crossings
      .map(c => ({ c, d: Math.hypot(c.x - px, c.y - py) }))
      .filter(({ d }) => d < FORD_REACH)
      .sort((m, n) => m.d - n.d)[0];
    if (nearest) {
      fordOf.set(nearest.c, place);
    }
  }
  return crossings.map(c => {
    const ford = fordOf.get(c);
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    return {
      geometry: { coordinates: [c.x, c.y], type: 'Point' },
      properties: {
        angle: c.angle,
        id: `crossing:${x},${y}`,
        kind: ford ? 'ford' : 'bridge',
        layer: 'crossing',
        span: Math.round(c.span),
        ...(ford ? { place: ford.properties.name } : {})
      },
      type: 'Feature'
    };
  });
};

// A deterministic hash for scattering symbols.
const hash = (x: number, y: number, salt = 0): number => {
  let r =
    Math.imul(x + 173, 374_761_393) ^
    Math.imul(y + 619, 668_265_263) ^
    Math.imul(salt + 1, 1_274_126_177);
  r = Math.imul(r ^ (r >>> 13), 1_274_126_177);
  return (r ^ (r >>> 16)) >>> 0;
};

// Trees, peaks and hill marks scattered over the regions of their kind,
// each with a rank so the renderer can thin them as the map zooms out.
export const scatterSymbols = (
  source: SourceData,
  ground: Ground,
  // Map pixels kept clear of trees, around the roads.
  clearing: Uint8Array
): GeographyFeature[] => {
  const [mapW, mapH] = mapSize(source.tilemap);
  const kindAt = (x: number, y: number): GroundKind | null =>
    x < 0 || y < 0 || x >= mapW || y >= mapH
      ? null
      : GROUND_KINDS[
          ground.kinds[
            Math.floor(y / ground.step) * ground.width +
              Math.floor(x / ground.step)
          ]!
        ]!;
  // Scattered symbols and how far apart; crossings are placed elsewhere.
  const spacing: Partial<Record<SymbolKind, number>> = {
    hill: 12,
    marsh: 7,
    tree: 9
  };
  const kindFor: Partial<Record<GroundKind, SymbolKind>> = {
    forest: 'tree',
    hill: 'hill',
    marsh: 'marsh',
    mountain: 'peak'
  };
  const features: GeographyFeature[] = [];
  for (const symbol of SYMBOL_KINDS) {
    const step = spacing[symbol];
    if (!step) {
      continue;
    }
    for (let gy = 0; gy * step < mapH; gy++) {
      for (let gx = 0; gx * step < mapW; gx++) {
        const r = hash(gx, gy, symbol.length);
        const x = (gx + 0.5) * step + ((r % 101) / 100 - 0.5) * step * 0.7;
        const y =
          (gy + 0.5) * step + (((r >>> 8) % 101) / 100 - 0.5) * step * 0.7;
        const kind = kindAt(x, y);
        if (!kind || kindFor[kind] !== symbol) {
          continue;
        }
        // Keep symbols a little inside their region.
        if (
          [
            [-5, 0],
            [5, 0],
            [0, -5],
            [0, 5]
          ].some(([dx, dy]) => kindAt(x + dx!, y + dy!) !== kind)
        ) {
          continue;
        }
        if (clearing[Math.floor(y) * mapW + Math.floor(x)]) {
          continue;
        }
        // Rank 0 shows at every zoom; higher ranks only closer in.
        const rank = (r >>> 16) % 4 === 0 ? 0 : (r >>> 16) % 4 === 1 ? 1 : 2;
        features.push({
          geometry: { coordinates: [x, y], type: 'Point' },
          properties: {
            id: `symbol:${symbol}:${gx},${gy}`,
            kind: symbol,
            layer: 'symbol',
            rank,
            variant: (r >>> 24) % 3
          },
          type: 'Feature'
        });
      }
    }
  }
  return features;
};

// ---------------------------------------------------------------------------
// Mountain ranges: peaks lined up along each range's spine, larger where
// the range is broad, with smaller foothills towards its edges, as
// Tolkien drew them. A peak's variant packs its size class (0 to 4) and
// its lean (0 to 2) as size × 3 + lean.

// Distance in map pixels from each cell of a mask to the nearest cell
// outside it, by a two-pass chamfer.
export const insideDistance = (
  mask: Uint8Array,
  width: number,
  height: number,
  step: number
): Float32Array => {
  const d = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    d[i] = mask[i] ? 1e9 : 0;
  }
  const a = step;
  const b = step * Math.SQRT2;
  const relax = (i: number, j: number, cost: number): void => {
    if (d[j]! + cost < d[i]!) {
      d[i] = d[j]! + cost;
    }
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!d[i]) {
        continue;
      }
      // Off the map counts as outside.
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        d[i] = Math.min(d[i]!, a);
      }
      if (x > 0) {
        relax(i, i - 1, a);
      }
      if (y > 0) {
        relax(i, i - width, a);
      }
      if (x > 0 && y > 0) {
        relax(i, i - width - 1, b);
      }
      if (x < width - 1 && y > 0) {
        relax(i, i - width + 1, b);
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!d[i]) {
        continue;
      }
      if (x < width - 1) {
        relax(i, i + 1, a);
      }
      if (y < height - 1) {
        relax(i, i + width, a);
      }
      if (x < width - 1 && y < height - 1) {
        relax(i, i + width + 1, b);
      }
      if (x > 0 && y < height - 1) {
        relax(i, i + width - 1, b);
      }
    }
  }
  return d;
};

// A peak's size class from how far it stands inside its range.
const peakSize = (inside: number): number =>
  inside < 6 ? 0 : inside < 10 ? 1 : inside < 16 ? 2 : inside < 24 ? 3 : 4;

export const placePeaks = (ground: Ground): GeographyFeature[] => {
  const { step, width } = ground;
  const height = ground.kinds.length / width;
  const mountain = GROUND_KINDS.indexOf('mountain');
  const mask = new Uint8Array(ground.kinds.length);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = Number(ground.kinds[i] === mountain);
  }
  const inside = insideDistance(mask, width, height, step);
  const insideAt = ([x, y]: Point): number =>
    inside[Math.floor(y / step) * width + Math.floor(x / step)] ?? 0;
  // The spine: the mask thinned to its centre lines, short spurs dropped.
  const spine = mask.slice();
  thin(spine, width, height);
  const ridges = followSkeleton(spine, width, height)
    .map(line =>
      line.map(([x, y]): Point => [(x + 0.5) * step, (y + 0.5) * step])
    )
    .filter(line => lineLength(line) >= 12);
  const peaks: {
    lean: number;
    rank: number;
    size: number;
    x: number;
    y: number;
  }[] = [];
  const clear = (x: number, y: number, gap: number): boolean =>
    peaks.every(p => Math.hypot(p.x - x, p.y - y) >= gap);
  for (const ridge of ridges) {
    // Walk the spine, a peak every so often: further apart where peaks
    // are bigger.
    let next = 0;
    let walked = 0;
    for (let i = 0; i < ridge.length - 1; i++) {
      const [ax, ay] = ridge[i]!;
      const [bx, by] = ridge[i + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      while (next <= walked + len) {
        const t = (next - walked) / (len || 1);
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const size = peakSize(insideAt([x, y]));
        const r = hash(Math.round(x), Math.round(y), 7);
        if (clear(x, y, 7 + size * 2)) {
          peaks.push({ lean: r % 3, rank: size >= 2 ? 0 : 1, size, x, y });
        }
        next += 9 + size * 3;
      }
      walked += len;
    }
  }
  // Foothills: small peaks scattered between the spine and the edges.
  const SPACING = 12;
  for (let gy = 0; gy * SPACING < height * step; gy++) {
    for (let gx = 0; gx * SPACING < width * step; gx++) {
      const r = hash(gx, gy, 11);
      const x = (gx + 0.5) * SPACING + ((r % 101) / 100 - 0.5) * SPACING * 0.8;
      const y =
        (gy + 0.5) * SPACING + (((r >>> 8) % 101) / 100 - 0.5) * SPACING * 0.8;
      const depth = insideAt([x, y]);
      if (depth < 4 || !clear(x, y, 9)) {
        continue;
      }
      peaks.push({
        lean: (r >>> 16) % 3,
        rank: 2,
        size: depth < 10 ? 0 : 1,
        x,
        y
      });
    }
  }
  // Back to front, so nearer peaks overlap those behind.
  return peaks
    .sort((a, b) => a.y - b.y)
    .map(p => ({
      geometry: { coordinates: [p.x, p.y], type: 'Point' },
      properties: {
        id: `symbol:peak:${Math.round(p.x)},${Math.round(p.y)}`,
        kind: 'peak',
        layer: 'symbol',
        rank: p.rank,
        variant: p.size * 3 + p.lean
      },
      type: 'Feature'
    }));
};

// The ink pictures Places are drawn with. `area` is a named stretch of
// country, lettered but not pictured.
export const PICTOGRAMS = [
  'area',
  'town',
  'city',
  'castle',
  'ruin',
  'tower',
  'citadel',
  'gate',
  'elven',
  'hold',
  'bridge',
  'ford',
  'volcano'
] as const;
export type Pictogram = (typeof PICTOGRAMS)[number];

// Each kind of Place the data names (finding:places-kinds-matched-by-map-tile)
// and its picture. Places with no kind get theirs from a patch.
const PICTOGRAM_BY_KIND: Record<string, Pictogram> = {
  'a castle': 'castle',
  'a large town': 'city',
  'an evil citadel': 'citadel',
  'a ruin': 'ruin',
  'a ruined castle': 'ruin',
  'a small town': 'town'
};

export const placeLabels = (source: SourceData): GeographyFeature[] =>
  source.places.map(place => ({
    geometry: {
      coordinates: [place.position.x + TILE / 2, place.position.y + TILE / 2],
      type: 'Point'
    },
    properties: {
      id: `place:${place.name}`,
      layer: 'place',
      name: place.name,
      pictogram: PICTOGRAM_BY_KIND[place.tile_kind ?? ''] ?? 'area',
      rank: source.strongholds.has(place.name) ? 0 : 1
    },
    type: 'Feature'
  }));

// ---------------------------------------------------------------------------
// Patches: committed GeoJSON that replaces, adds or deletes whole features
// by id (ADR-0006).

export interface Patch {
  features: (GeographyFeature & {
    properties: { op?: 'add' | 'delete' | 'replace' };
  })[];
}

export const applyPatches = (
  geography: Geography,
  patches: Patch[]
): Geography => {
  const byId = new Map(geography.features.map(f => [f.properties.id, f]));
  for (const patch of patches) {
    for (const feature of patch.features) {
      const { op = 'replace', ...properties } = feature.properties;
      const { id } = properties;
      if (op === 'delete') {
        if (!byId.delete(id)) {
          throw new Error(`patch deletes unknown ${id}`);
        }
      } else if (op === 'replace') {
        const old = byId.get(id);
        if (!old) {
          throw new Error(`patch replaces unknown ${id}`);
        }
        // A patch with no geometry changes only properties.
        byId.set(id, {
          ...feature,
          geometry: feature.geometry ?? old.geometry,
          properties: { ...old.properties, ...properties }
        });
      } else {
        if (byId.has(id)) {
          throw new Error(`patch adds existing ${id}`);
        }
        byId.set(id, { ...feature, properties });
      }
    }
  }
  return { ...geography, features: [...byId.values()] };
};

// ---------------------------------------------------------------------------
// Validation.

export interface Validation {
  // Terrain Regions' total area against the map's.
  areaError: number;
  // Of tile centres, how many fall in exactly one region, and how many of
  // those have the tile's own terrain percentage.
  covered: number;
  matching: number;
  overlapping: number;
  samples: number;
}

export const validate = (
  geography: Geography,
  tilemap: Tilemap,
  terrainByTile: number[]
): Validation => {
  const regions = geography.features
    .filter(f => f.properties.layer === 'terrain-region')
    .map(f => {
      const polygons = f.geometry.coordinates as Ring[][];
      const xs = polygons.flatMap(p => p[0]!.map(q => q[0]));
      const ys = polygons.flatMap(p => p[0]!.map(q => q[1]));
      return {
        box: [
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs),
          Math.max(...ys)
        ],
        polygons,
        terrain: f.properties.terrain as number
      };
    });
  let area = 0;
  for (const r of regions) {
    for (const [outer, ...holes] of r.polygons) {
      area +=
        Math.abs(signedArea(outer!)) -
        holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
    }
  }
  const [w, h] = mapSize(tilemap);
  let covered = 0;
  let matching = 0;
  let overlapping = 0;
  for (let ty = 0; ty < tilemap.height; ty++) {
    for (let tx = 0; tx < tilemap.width; tx++) {
      const p: Point = [tx * TILE + TILE / 2, ty * TILE + TILE / 2];
      const hits = regions.filter(
        r =>
          p[0] >= r.box[0]! &&
          p[0] <= r.box[2]! &&
          p[1] >= r.box[1]! &&
          p[1] <= r.box[3]! &&
          r.polygons.some(
            ([outer, ...holes]) =>
              pointInRing(p, outer!) &&
              !holes.some(hole => pointInRing(p, hole))
          )
      );
      if (hits.length === 1) {
        covered++;
        const expected =
          terrainByTile[tilemap.indices[ty * tilemap.width + tx]!] ?? 100;
        matching += Number(hits[0]!.terrain === expected);
      } else if (hits.length > 1) {
        overlapping++;
      }
    }
  }
  return {
    areaError: Math.abs(area - w * h) / (w * h),
    covered,
    matching,
    overlapping,
    samples: tilemap.width * tilemap.height
  };
};

// ---------------------------------------------------------------------------
// The compiled bundle: a JSON header, then binary sections, each aligned
// to 4 bytes. Map coordinates are unsigned 16-bit fixed point, in eighths
// of a map pixel, which covers the 2560 by 1584 map with room to spare.
//
//   u32 header length, header JSON (UTF-8, padded to 4 bytes), sections
//
// fillVertices: u16 x, u16 y, u16 kind                    6 bytes each
// fillIndices:  u16 per triangle corner, counted from the first vertex of
//               its chunk, so each chunk of up to 65,536 vertices is drawn
//               on its own (header.fillChunks)
// linePoints:   u16 x, u16 y, f32 along, u8 style, 3 pad  12 bytes each.
//               Each point starts a segment to the next point, drawn in
//               its style; NO_SEGMENT ends a run of line. `along` is the
//               distance along the line, for dashes.
// symbols:      u16 x, u16 y, u8 kind, u8 variant, u8 rank, u8 angle
//               (0 to 255 over half a turn)  8 bytes

export const FIXED_POINT = 8;
export const NO_SEGMENT = 255;

type SectionName = 'fillIndices' | 'fillVertices' | 'linePoints' | 'symbols';

export interface BundleHeader {
  bounds: [number, number, number, number];
  // Where each chunk of fill starts, in indices and vertices.
  fillChunks: { firstIndex: number; firstVertex: number }[];
  fixedPoint: number;
  lineStyles: readonly string[];
  pictograms: readonly string[];
  places: {
    name: string;
    pictogram: number;
    rank: number;
    x: number;
    y: number;
  }[];
  regionKinds: readonly string[];
  regionLabels: { name: string; rank: number; x: number; y: number }[];
  sections: Record<SectionName, { count: number; offset: number }>;
  symbolKinds: readonly string[];
  version: 2;
}

interface Fill {
  chunks: { firstIndex: number; firstVertex: number }[];
  indices: number[];
  // x, y, kind per vertex.
  vertices: number[];
}

const CHUNK_VERTICES = 65_536;

const triangulate = (polygon: Ring[], out: Fill, kind: number): void => {
  const flat: number[] = [];
  const holes: number[] = [];
  for (const [i, ring] of polygon.entries()) {
    if (i > 0) {
      holes.push(flat.length / 2);
    }
    for (const [x, y] of ring) {
      flat.push(x, y);
    }
  }
  const count = flat.length / 2;
  if (count > CHUNK_VERTICES) {
    throw new Error(`a polygon of ${count} points is too big for one chunk`);
  }
  const vertices = out.vertices.length / 3;
  let chunk = out.chunks.at(-1);
  if (!chunk || vertices - chunk.firstVertex + count > CHUNK_VERTICES) {
    chunk = { firstIndex: out.indices.length, firstVertex: vertices };
    out.chunks.push(chunk);
  }
  const base = vertices - chunk.firstVertex;
  for (let i = 0; i < flat.length; i += 2) {
    out.vertices.push(flat[i]!, flat[i + 1]!, kind);
  }
  for (const i of earcut(flat, holes)) {
    out.indices.push(base + i);
  }
};

// x, y, along, style per point.
type LinePoints = number[];

// A line as runs of points, each segment in the style `styleOf` gives it,
// or left out where it gives -1. A run ends where the style changes.
const stroke = (
  points: Point[],
  closed: boolean,
  out: LinePoints,
  fixed: number,
  styleOf?: (a: Point, b: Point) => number
): void => {
  let along = 0;
  let open = -1;
  const end = (at: Point, distance: number): void => {
    if (open >= 0) {
      out.push(at[0], at[1], distance, NO_SEGMENT);
      open = -1;
    }
  };
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const style = len ? (styleOf ? styleOf(a, b) : fixed) : open;
    if (style !== open) {
      end(a, along);
      if (style >= 0) {
        open = style;
      }
    }
    if (open >= 0 && len) {
      out.push(a[0], a[1], along, open);
    }
    along += len;
  }
  end(points[closed ? 0 : points.length - 1]!, along);
};

const segmentKey = (a: Point, b: Point): string =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`;

const layerOrder = (layer: string): number =>
  [
    'terrain-region',
    'ground',
    'road',
    'symbol',
    'crossing',
    'place',
    'region-label'
  ].indexOf(layer);

export const compileBundle = (geography: Geography): Uint8Array => {
  const fill: Fill = { chunks: [], indices: [], vertices: [] };
  const lines: LinePoints = [];
  const symbols: number[] = [];
  const header: BundleHeader = {
    bounds: geography.bounds,
    fillChunks: fill.chunks,
    fixedPoint: FIXED_POINT,
    lineStyles: LINE_STYLES,
    pictograms: PICTOGRAMS,
    places: [],
    regionKinds: GROUND_KINDS,
    regionLabels: [],
    sections: {} as BundleHeader['sections'],
    symbolKinds: SYMBOL_KINDS,
    version: 2
  };
  // The map is drawn from the ground; the Terrain Regions stay in the
  // source GeoJSON until the sim reads them (ADR-0006). Ink is drawn only where the kind of
  // ground changes. Shared borders are the same segments either side, so
  // each segment is matched with its twin.
  const STYLE_BY_KIND: Partial<Record<string, number>> = {
    forest: LINE_STYLES.indexOf('forest'),
    mountain: LINE_STYLES.indexOf('mountain'),
    river: LINE_STYLES.indexOf('river'),
    water: LINE_STYLES.indexOf('coast')
  };
  // Where two kinds meet, the stronger line wins; hills and plains are
  // not outlined.
  const PRIORITY = ['water', 'river', 'mountain', 'forest', 'hill', 'plain'];
  const sideKinds = new Map<string, string[]>();
  for (const f of geography.features) {
    if (f.properties.layer !== 'ground') {
      continue;
    }
    for (const polygon of f.geometry.coordinates as Ring[][]) {
      for (const ring of polygon) {
        ring.forEach((a, i) => {
          const k = segmentKey(a, ring[(i + 1) % ring.length]!);
          sideKinds.set(k, [
            ...(sideKinds.get(k) ?? []),
            f.properties.kind as string
          ]);
        });
      }
    }
  }
  const sorted = [...geography.features].sort(
    (a, b) => layerOrder(a.properties.layer) - layerOrder(b.properties.layer)
  );
  const drawn = new Set<string>();
  for (const f of sorted) {
    const { layer } = f.properties;
    if (layer === 'ground') {
      const kindIndex = header.regionKinds.indexOf(f.properties.kind as string);
      for (const polygon of f.geometry.coordinates as Ring[][]) {
        triangulate(polygon, fill, kindIndex);
        for (const ring of polygon) {
          stroke(ring, true, lines, -1, (a, b) => {
            const k = segmentKey(a, b);
            const kinds = sideKinds.get(k) ?? [];
            // The map's edge, a border within one kind, or one already inked.
            if (kinds.length < 2 || kinds[0] === kinds[1] || drawn.has(k)) {
              return -1;
            }
            drawn.add(k);
            const strongest = [...kinds].sort(
              (x, y) => PRIORITY.indexOf(x) - PRIORITY.indexOf(y)
            )[0]!;
            return STYLE_BY_KIND[strongest] ?? -1;
          });
        }
      }
    } else if (layer === 'road') {
      stroke(
        f.geometry.coordinates as Point[],
        false,
        lines,
        LINE_STYLES.indexOf('road')
      );
    } else if (layer === 'region-label') {
      const [x, y] = f.geometry.coordinates as Point;
      header.regionLabels.push({
        name: f.properties.name as string,
        rank: f.properties.rank as number,
        x,
        y
      });
    } else if (layer === 'symbol') {
      const [x, y] = f.geometry.coordinates as Point;
      symbols.push(
        x,
        y,
        SYMBOL_KINDS.indexOf(f.properties.kind as SymbolKind),
        f.properties.variant as number,
        f.properties.rank as number,
        0
      );
    } else if (layer === 'crossing') {
      const [x, y] = f.geometry.coordinates as Point;
      symbols.push(
        x,
        y,
        SYMBOL_KINDS.indexOf(f.properties.kind as SymbolKind),
        // A crossing's variant is the width of water it spans.
        Math.min(255, f.properties.span as number),
        0,
        Math.round(((f.properties.angle as number) / Math.PI) * 255) % 256
      );
    } else if (layer === 'place') {
      const [x, y] = f.geometry.coordinates as Point;
      header.places.push({
        name: f.properties.name as string,
        pictogram: PICTOGRAMS.indexOf(f.properties.pictogram as Pictogram),
        rank: f.properties.rank as number,
        x,
        y
      });
    }
  }
  const fixed = (v: number): number =>
    Math.max(0, Math.min(65_535, Math.round(v * FIXED_POINT)));
  const sizes: Record<SectionName, [count: number, bytes: number]> = {
    fillIndices: [fill.indices.length, 2],
    fillVertices: [fill.vertices.length / 3, 6],
    linePoints: [lines.length / 4, 12],
    symbols: [symbols.length / 6, 8]
  };
  let offset = 0;
  for (const name of Object.keys(sizes) as SectionName[]) {
    const [count, bytes] = sizes[name];
    header.sections[name] = { count, offset };
    offset += Math.ceil((count * bytes) / 4) * 4;
  }
  const json = new TextEncoder().encode(JSON.stringify(header));
  const headerBytes = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(4 + headerBytes + offset);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, headerBytes, true);
  bytes.set(json, 4);
  bytes.fill(0x20, 4 + json.length, 4 + headerBytes);
  const start = (name: SectionName): number =>
    4 + headerBytes + header.sections[name].offset;
  let at = start('fillVertices');
  for (let i = 0; i < fill.vertices.length; i += 3) {
    view.setUint16(at, fixed(fill.vertices[i]!), true);
    view.setUint16(at + 2, fixed(fill.vertices[i + 1]!), true);
    view.setUint16(at + 4, fill.vertices[i + 2]!, true);
    at += 6;
  }
  at = start('fillIndices');
  for (const index of fill.indices) {
    view.setUint16(at, index, true);
    at += 2;
  }
  at = start('linePoints');
  for (let i = 0; i < lines.length; i += 4) {
    view.setUint16(at, fixed(lines[i]!), true);
    view.setUint16(at + 2, fixed(lines[i + 1]!), true);
    view.setFloat32(at + 4, lines[i + 2]!, true);
    view.setUint8(at + 8, lines[i + 3]!);
    at += 12;
  }
  at = start('symbols');
  for (let i = 0; i < symbols.length; i += 6) {
    view.setUint16(at, fixed(symbols[i]!), true);
    view.setUint16(at + 2, fixed(symbols[i + 1]!), true);
    view.setUint8(at + 4, symbols[i + 2]!);
    view.setUint8(at + 5, symbols[i + 3]!);
    view.setUint8(at + 6, symbols[i + 4]!);
    view.setUint8(at + 7, symbols[i + 5]!);
    at += 8;
  }
  return bytes;
};

// ---------------------------------------------------------------------------

const root = join(import.meta.dir, '..');

const loadSource = async (assets: string): Promise<SourceData> => {
  const start = await Bun.file(join(assets, 'starting-state.json')).json();
  return {
    atlas: PNG.sync.read(
      Buffer.from(await Bun.file(join(assets, 'campaign/tiles.png')).bytes())
    ),
    places: start.places,
    // The five major Good Places (GLOSSARY.md, Stronghold).
    strongholds: new Set(
      (start.places as { name: string }[])
        .map(p => p.name)
        .filter(n => /hornburg|edoras|minas tirith|lorien|thranduil/i.test(n))
    ),
    terrainByTile: start.terrain_by_tile,
    tilemap: await Bun.file(join(assets, 'campaign/tilemap.json')).json()
  };
};

const loadPatches = async (dir: string): Promise<Patch[]> =>
  existsSync(dir)
    ? Promise.all(
        readdirSync(dir)
          .filter(name => name.endsWith('.geojson'))
          .sort()
          .map(name => Bun.file(join(dir, name)).json() as Promise<Patch>)
      )
    : [];

export const main = async (): Promise<number> => {
  const assets = join(root, 'web/public/assets');
  if (!existsSync(join(assets, 'campaign/tilemap.json'))) {
    console.error('build-geography: run `bun run export:web` first');
    return 1;
  }
  const source = await loadSource(assets);
  const kinds = tileKinds(source.atlas, source.terrainByTile);
  const ground = traceGround(source);
  const roads = traceRoads(source);
  const [w, h] = mapSize(source.tilemap);
  const traced: Geography = {
    bounds: [0, 0, w, h],
    features: [
      ...traceTerrainRegions(source, kinds),
      ...ground.features,
      ...roads.features,
      ...scatterSymbols(source, ground, roads.clearing),
      ...placePeaks(ground),
      ...placeLabels(source)
    ],
    type: 'FeatureCollection'
  };
  // Crossings are traced from the patched Places and roads, so patches to
  // crossings apply after them.
  const patches = await loadPatches(join(root, 'geography/patches'));
  const patched = applyPatches(
    traced,
    patches.map(p => ({ features: p.features.filter(f => !isCrossing(f)) }))
  );
  const geography = applyPatches(
    {
      ...patched,
      features: [
        ...patched.features,
        ...traceCrossings(
          source,
          ground,
          patched.features.filter(f => f.properties.layer === 'road'),
          patched.features.filter(f => f.properties.layer === 'place')
        )
      ]
    },
    patches.map(p => ({ features: p.features.filter(isCrossing) }))
  );
  const check = validate(geography, source.tilemap, source.terrainByTile);
  const out = join(assets, 'geography');
  mkdirSync(out, { recursive: true });
  await Bun.write(join(out, 'source.geojson'), JSON.stringify(geography));
  const bundle = compileBundle(geography);
  await Bun.write(join(out, 'bundle.bin'), bundle);
  const pct = (n: number): string =>
    `${((n / check.samples) * 100).toFixed(1)}%`;
  console.log(
    `build-geography: ${geography.features.length} features, ${(bundle.length / 1024).toFixed(0)} KiB bundle; ` +
      `tile centres covered ${pct(check.covered)}, matching terrain ${pct(check.matching)}, ` +
      `overlapping ${check.overlapping}; area error ${(check.areaError * 100).toFixed(3)}%`
  );
  if (check.overlapping > 0 || check.areaError > 0.001) {
    console.error('build-geography: Terrain Regions overlap or leave gaps');
    return 1;
  }
  return 0;
};

if (import.meta.main) {
  process.exit(await main());
}
