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
// Their lettering is the game's own font, recoloured. Each is drawn
// through a DebugProjection, so the same views sit over the Classic
// view or, scaled, over the Atlas map.

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

// How the map's world pixels land on the native screen: `toScreen` and
// its inverse `toWorld`, and `scale`, native pixels per world pixel.
export interface DebugProjection {
  scale: number;
  toScreen(world: Point): Point;
  toWorld(screen: Point): Point;
}

// The Classic view's projection: one native pixel per world pixel,
// offset by its camera.
export const classicProjection = (camera: Point): DebugProjection => ({
  scale: 1,
  toScreen: ({ x, y }) => ({ x: x - camera.x, y: y - camera.y }),
  toWorld: ({ x, y }) => ({ x: x + camera.x, y: y + camera.y })
});

// A projection from its world-to-screen mapping and inverse, the scale
// read off the mapping.
export const projectionOf = (
  toScreen: (world: Point) => Point,
  toWorld: (screen: Point) => Point
): DebugProjection => ({
  scale: toScreen({ x: 1, y: 0 }).x - toScreen({ x: 0, y: 0 }).x,
  toScreen,
  toWorld
});

// A terrain percentage as a colour: red at 1%, through yellow, to
// green at 100%. 0% is impassable and hatched instead.
export const terrainColour = (percent: number, alpha = 0.45): string =>
  `hsla(${Math.round((Math.min(100, percent) / 100) * 120)}, 90%, 50%, ${alpha})`;

// A Side's colour, by allegiance (finding:mobilisation-allegiance-byte):
// 0 Evil, 1 Neutral (not yet mobilised), anything above Good.
export const sideColour = (allegiance: number): string =>
  allegiance === 0 ? '#ff4040' : allegiance === 1 ? '#e0e040' : '#40c0ff';

export const drawTerrainView = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  view: DebugProjection
): void => {
  if (!sim.tilemap) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, MAP_HEIGHT);
  ctx.clip();
  const topLeft = view.toWorld({ x: 0, y: 0 });
  const bottomRight = view.toWorld({ x: ctx.canvas.width, y: MAP_HEIGHT });
  const size = TILE_SIZE * view.scale;
  const firstX = Math.max(0, Math.floor(topLeft.x / TILE_SIZE));
  const firstY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE));
  const lastX = Math.min(
    sim.tilemap.width - 1,
    Math.floor(bottomRight.x / TILE_SIZE)
  );
  const lastY = Math.min(
    sim.tilemap.height - 1,
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
// clear of the icon column.
export const drawTerrainLegend = (
  ctx: CanvasRenderingContext2D,
  font: Font
): void => {
  const steps = [0, 25, 50, 75, 100];
  const step = 20;
  const { height } = font.metrics;
  const x = 160 - (steps.length * step) / 2;
  const y = MAP_HEIGHT - height - 8;
  steps.forEach((percent, i) => {
    ctx.fillStyle = percent === 0 ? '#333' : terrainColour(percent, 1);
    ctx.fillRect(x + i * step, y, step - 2, 3);
    drawOutlined(ctx, font, `${percent}`, x + i * step, y + 4, '#fff');
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
  font: Font
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
    drawOutlined(
      ctx,
      font,
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
  font: Font
): void => {
  const { height } = font.metrics;
  ctx.save();
  for (const force of forces) {
    const text = forceLabel(force);
    const width = measureText(font.metrics, text);
    const top = view.toScreen({
      x: force.position.x + TILE_SIZE / 2,
      y: force.position.y
    });
    const x = Math.round(top.x - width / 2);
    const y = Math.round(top.y) - height - 1;
    drawOutlined(ctx, font, text, x, y, sideColour(force.leader.allegiance));
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
  font: Font
): void => {
  if (!pointer || pointer.y < 0 || pointer.y >= MAP_HEIGHT) {
    return;
  }
  const world = view.toWorld(pointer);
  const lines = pointerInfo(sim, {
    x: Math.floor(world.x),
    y: Math.floor(world.y)
  });
  const { height } = font.metrics;
  // At the bottom left, clear of the Menu button and the windows.
  const top = MAP_HEIGHT - lines.length * height - 6;
  drawOutlined(ctx, font, lines.join('\n'), 4, top + 2, '#fff');
};
