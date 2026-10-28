import { isEncounter } from '../sim/encounters';
import { terrainAt } from '../sim/movement';
import {
  TILE_SIZE,
  placeAt,
  tileOf,
  type Force,
  type Point,
  type RosterEntry
} from '../sim/starting-state';
import type { SimState } from '../sim/state';
import { drawText, measureText, type Font } from './font';

// The Debug views (GLOSSARY.md): overlays on the Campaign Level that
// show the game's hidden workings, for those developing the port. They
// are not the original's and not part of the game as played; the
// settings offer them only in a dev build or with ?debug in the URL.
// Drawn in native pixels: the terrain into the screen buffer under the
// figures, the rest over the figures but under the message windows.
// Each is drawn through a DebugProjection and a DebugLettering: over
// the Classic view in native pixels and the game's own font, recoloured;
// over the Atlas map on a canvas of its own, at the window's resolution,
// in a small system font.

export interface DebugViews {
  encounters: boolean;
  labels: boolean;
  paths: boolean;
  pointer: boolean;
  terrain: boolean;
}

export const DEBUG_VIEW_ORDER: (keyof DebugViews)[] = [
  'terrain',
  'paths',
  'encounters',
  'labels',
  'pointer'
];

export const DEBUG_VIEW_LABELS: Record<keyof DebugViews, string> = {
  encounters: 'Encounter areas',
  labels: 'Force labels',
  paths: 'Paths',
  pointer: 'Pointer info',
  terrain: 'Terrain'
};

export const NO_DEBUG_VIEWS: DebugViews = {
  encounters: false,
  labels: false,
  paths: false,
  pointer: false,
  terrain: false
};

export const anyDebugView = (views: DebugViews): boolean =>
  DEBUG_VIEW_ORDER.some(key => views[key]);

// Whether the Debug views are offered: a dev build, or ?debug.
export const debugAllowed = (): boolean =>
  Boolean(import.meta.env.DEV) ||
  new URLSearchParams(globalThis.location?.search ?? '').has('debug');

// The map view's height in native pixels; the date line is below it.
const MAP_HEIGHT = 192;

// How the map's world pixels land on the canvas drawn into: `toScreen`
// and its inverse `toWorld`; `scale`, canvas pixels per world pixel; and
// the map view's `width` and `height` in canvas pixels.
export interface DebugProjection {
  height: number;
  scale: number;
  toScreen(world: Point): Point;
  toWorld(screen: Point): Point;
  width: number;
}

// The Classic view's projection: one native pixel per world pixel,
// offset by its camera, over the 320 by 192 map view.
export const classicProjection = (camera: Point): DebugProjection => ({
  height: MAP_HEIGHT,
  scale: 1,
  toScreen: ({ x, y }) => ({ x: x - camera.x, y: y - camera.y }),
  toWorld: ({ x, y }) => ({ x: x + camera.x, y: y + camera.y }),
  width: 320
});

// A projection from its world-to-screen mapping and inverse over a map
// view of the given size, the scale read off the mapping.
export const projectionOf = (
  toScreen: (world: Point) => Point,
  toWorld: (screen: Point) => Point,
  size: { height: number; width: number }
): DebugProjection => ({
  ...size,
  scale: toScreen({ x: 1, y: 0 }).x - toScreen({ x: 0, y: 0 }).x,
  toScreen,
  toWorld
});

// How the Debug views letter: a line's height and width, and drawing
// text, outlined in black to read on any terrain, its top left at (x, y).
export interface DebugLettering {
  draw(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    colour: string
  ): void;
  height: number;
  measure(text: string): number;
}

// The game's font, for the Classic view.
export const pixelLettering = (font: Font): DebugLettering => ({
  draw: (ctx, text, x, y, colour) =>
    drawOutlined(ctx, font, text, x, y, colour),
  height: font.metrics.height,
  measure: text => measureText(font.metrics, text)
});

// A small system font, for the Atlas map's canvas.
export const canvasLettering = (
  ctx: CanvasRenderingContext2D,
  size = 11
): DebugLettering => {
  const font = `bold ${size}px ui-monospace, Menlo, monospace`;
  const height = Math.round(size * 1.25);
  return {
    draw: (target, text, x, y, colour) => {
      target.save();
      target.font = font;
      target.textBaseline = 'top';
      target.lineJoin = 'round';
      target.lineWidth = 3;
      target.strokeStyle = '#000';
      target.fillStyle = colour;
      text.split('\n').forEach((line, row) => {
        target.strokeText(line, x, y + row * height);
        target.fillText(line, x, y + row * height);
      });
      target.restore();
    },
    height,
    measure: text => {
      ctx.save();
      ctx.font = font;
      const width = ctx.measureText(text).width;
      ctx.restore();
      return width;
    }
  };
};

// A terrain percentage as a colour: red at 1%, through yellow, to
// green at 100%. 0% is impassable and hatched instead.
export const terrainColour = (percent: number, alpha = 0.45): string =>
  `hsla(${Math.round((Math.min(100, percent) / 100) * 120)}, 90%, 50%, ${alpha})`;

// A Side's colour, by allegiance (finding:mobilisation-allegiance-byte):
// 0 Evil, 1 Neutral (not yet mobilised), anything above Good.
export const sideColour = (allegiance: number): string =>
  allegiance === 0 ? '#ff4040' : allegiance === 1 ? '#e0e040' : '#40c0ff';

// The same colour as red, green, blue and alpha from 0 to 1, for the
// Atlas map's renderer.
export const terrainRgba = (
  percent: number,
  alpha = 0.45
): [number, number, number, number] => {
  // CSS's hsl(), at 90% saturation and 50% lightness.
  const hue = Math.round((Math.min(100, percent) / 100) * 120);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return 0.5 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4), alpha];
};

// The terrain over the Atlas map, as tiles in map pixels to fill under
// its Places and Forces: each tile in view in its colour, impassable
// ones darkened.
export const terrainTiles = (
  sim: SimState,
  view: DebugProjection
): {
  colour: [number, number, number, number];
  h: number;
  w: number;
  x: number;
  y: number;
}[] => {
  if (!sim.terrain) {
    return [];
  }
  const topLeft = view.toWorld({ x: 0, y: 0 });
  const bottomRight = view.toWorld({ x: view.width, y: view.height });
  const tiles = [];
  for (
    let ty = Math.max(0, Math.floor(topLeft.y / TILE_SIZE));
    ty <= Math.min(sim.terrain.height - 1, bottomRight.y / TILE_SIZE);
    ty++
  ) {
    for (
      let tx = Math.max(0, Math.floor(topLeft.x / TILE_SIZE));
      tx <= Math.min(sim.terrain.width - 1, bottomRight.x / TILE_SIZE);
      tx++
    ) {
      const world = { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
      const percent = terrainAt(sim, world);
      tiles.push({
        colour:
          percent > 0
            ? terrainRgba(percent)
            : ([0, 0, 0, 0.55] as [number, number, number, number]),
        h: TILE_SIZE,
        w: TILE_SIZE,
        ...world
      });
    }
  }
  return tiles;
};

export const drawTerrainView = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  view: DebugProjection
): void => {
  if (!sim.terrain) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, view.width, view.height);
  ctx.clip();
  const topLeft = view.toWorld({ x: 0, y: 0 });
  const bottomRight = view.toWorld({ x: view.width, y: view.height });
  const size = TILE_SIZE * view.scale;
  const firstX = Math.max(0, Math.floor(topLeft.x / TILE_SIZE));
  const firstY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE));
  const lastX = Math.min(
    sim.terrain.width - 1,
    Math.floor(bottomRight.x / TILE_SIZE)
  );
  const lastY = Math.min(
    sim.terrain.height - 1,
    Math.floor(bottomRight.y / TILE_SIZE)
  );
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      const world = { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
      const { x, y } = view.toScreen(world);
      const percent = terrainAt(sim, world);
      if (percent > 0) {
        ctx.fillStyle = terrainColour(percent);
        ctx.fillRect(x, y, size, size);
        continue;
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(x, y, size, size);
      // The hatching, in world pixels, only where it can be seen.
      if (size < TILE_SIZE / 2) {
        continue;
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      const dot = Math.max(1, view.scale);
      for (let i = 0; i < TILE_SIZE; i += 4) {
        ctx.fillRect(x + i * view.scale, y + i * view.scale, dot, dot);
        ctx.fillRect(
          x + ((i + 2) % TILE_SIZE) * view.scale,
          y + (i + 2) * view.scale,
          dot,
          dot
        );
      }
    }
  }
  ctx.restore();
};

// The terrain legend, drawn over the frame at the bottom of the map,
// clear of the icon column, sized to its lettering.
export const drawTerrainLegend = (
  ctx: CanvasRenderingContext2D,
  view: DebugProjection,
  lettering: DebugLettering
): void => {
  const steps = [0, 25, 50, 75, 100];
  const { height } = lettering;
  const step = height * 2;
  const bar = Math.max(3, Math.round(height / 4));
  const x = view.width / 2 - (steps.length * step) / 2;
  const y = view.height - height - 8;
  steps.forEach((percent, i) => {
    ctx.fillStyle = percent === 0 ? '#333' : terrainColour(percent, 1);
    ctx.fillRect(x + i * step, y, step - 2, bar);
    lettering.draw(ctx, `${percent}`, x + i * step, y + bar + 1, '#fff');
  });
};

// The game's font with a black pixel border, readable on any terrain:
// the text in black at the eight offsets round it, then in its colour.
export const drawOutlined = (
  ctx: CanvasRenderingContext2D,
  font: Font,
  text: string,
  x: number,
  y: number,
  colour: string
): void => {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) {
        drawText(ctx, font, text, x + dx, y + dy, '#000');
      }
    }
  }
  drawText(ctx, font, text, x, y, colour);
};

const centreOf = (point: Point, view: DebugProjection): Point =>
  view.toScreen({ x: point.x + TILE_SIZE / 2, y: point.y + TILE_SIZE / 2 });

const dottedLine = (
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  width: number,
  arrow: boolean
): void => {
  ctx.lineWidth = width;
  ctx.setLineDash([width * 2, width * 2]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  if (!arrow) {
    return;
  }
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 4;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
};

// Where each Force is heading: a dotted arrow to its destination, from
// an Order or its Default Orders, then thinner dotted legs through the
// Default Orders stops still queued, each marked with a dot
// (finding:movement-arrival-pops-next-route-stop). Followers move with
// their Leader, so only the Leader's heading is drawn.
export const drawPathsView = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  forces: Force[],
  view: DebugProjection
): void => {
  ctx.save();
  for (const { leader, position } of forces) {
    if (!leader.destination) {
      continue;
    }
    const colour = sideColour(leader.allegiance);
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    let from = centreOf(position, view);
    let to = centreOf(leader.destination, view);
    dottedLine(ctx, from, to, 1, true);
    for (const stop of sim.routes[leader.route] ?? []) {
      const place = sim.places.find(candidate => candidate.index === stop);
      if (!place) {
        continue;
      }
      from = to;
      to = centreOf(place.position, view);
      dottedLine(ctx, from, to, 0.5, false);
      ctx.beginPath();
      ctx.arc(to.x, to.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

// Whether an Encounter figure can still be met: a chance of 0 is an
// advisor used up, and one whose day has not come waits
// (finding:forces-advisors-met-once,
// finding:forces-encounter-figures-wait-in-areas).
const encounterLive = (figure: RosterEntry, day: number): boolean =>
  figure.encounter !== null &&
  figure.encounter.chance > 0 &&
  day >= figure.encounter.earliestDay;

// Outlines only: some areas span most of the map, and their fills
// would bury it.
export const drawEncountersView = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  view: DebugProjection,
  lettering: DebugLettering
): void => {
  ctx.save();
  ctx.lineWidth = 0.5;
  for (const figure of sim.roster) {
    if (!isEncounter(figure.index) || !figure.encounter) {
      continue;
    }
    const { area } = figure.encounter;
    const live = encounterLive(figure, sim.clock.day);
    const { x, y } = view.toScreen({ x: area.left, y: area.top });
    const width = (area.right - area.left + TILE_SIZE) * view.scale;
    const height = (area.bottom - area.top + TILE_SIZE) * view.scale;
    ctx.strokeStyle = live ? '#ff80ff' : '#909090';
    ctx.strokeRect(x, y, width, height);
    lettering.draw(
      ctx,
      figure.name,
      Math.round(x + 2),
      Math.round(y + 1),
      live ? '#ffc0ff' : '#b0b0b0'
    );
  }
  ctx.restore();
};

export const forceLabel = (force: Force): string =>
  `${force.leader.index} ${force.leader.name} ${force.members.reduce(
    (total, member) => total + member.strength,
    0
  )}`;

export const drawLabelsView = (
  ctx: CanvasRenderingContext2D,
  forces: Force[],
  view: DebugProjection,
  lettering: DebugLettering
): void => {
  const { height } = lettering;
  ctx.save();
  for (const force of forces) {
    const text = forceLabel(force);
    const width = lettering.measure(text);
    const top = view.toScreen({
      x: force.position.x + TILE_SIZE / 2,
      y: force.position.y
    });
    const x = Math.round(top.x - width / 2);
    const y = Math.round(top.y) - height - 1;
    lettering.draw(ctx, text, x, y, sideColour(force.leader.allegiance));
  }
  ctx.restore();
};

// What is under the pointer: its tile, terrain percentage and Place.
export const pointerInfo = (sim: SimState, world: Point): string[] => {
  const tile = tileOf(world);
  const place = placeAt(sim.places, world);
  return [
    `tile ${tile.x},${tile.y}`,
    `terrain ${terrainAt(sim, world)}%`,
    ...(place ? [place.name] : [])
  ];
};

export const drawPointerView = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  view: DebugProjection,
  pointer: Point | null,
  lettering: DebugLettering
): void => {
  if (!pointer || pointer.y < 0 || pointer.y >= view.height) {
    return;
  }
  const world = view.toWorld(pointer);
  const lines = pointerInfo(sim, {
    x: Math.floor(world.x),
    y: Math.floor(world.y)
  });
  const { height } = lettering;
  // At the bottom left, clear of the Menu button and the windows.
  const top = view.height - lines.length * height - 6;
  lettering.draw(ctx, lines.join('\n'), 4, top + 2, '#fff');
};
