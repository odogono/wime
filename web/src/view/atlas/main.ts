// The Atlas map proof of concept (ADR-0006): the vector geography drawn
// with WebGL, zooming continuously from the Full Map Level band into the
// Campaign Level band, with the game's Forces drawn at their
// level-of-detail tiers. The game itself still uses the Classic renderer.
import {
  createSim,
  forcesOnMap,
  tickSim,
  type Force,
  type SimState
} from '../../sim/index';
import { loadCampaignAssets } from '../assets';
import { iconSourceRect } from '../campaign-level';
import { loadBundle } from './bundle';
import {
  SPRITE_SIZE,
  bandAt,
  clusterDots,
  placeLabels,
  rankZoom,
  spriteScale,
  tierFor,
  zoomRange,
  type Band,
  type Tier,
  type ZoomRange
} from './lod';
import { PEAKS, buildPictogramAtlas } from './pictograms';
import { AtlasRenderer, INK, PAPER, QuadMode, type Quad } from './renderer';
import { buildSdfFont, measure, type SdfFont } from './sdf-font';

const canvas = document.querySelector<HTMLCanvasElement>('#atlas')!;
const hud = document.querySelector<HTMLElement>('#hud')!;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
// Region names are lettered in a lighter, browner ink.
const REGION_INK = '#6e5232';

const rgba = (hex: string, alpha = 1): [number, number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255, alpha];
};

// Side colours as on the Full Map Level: Evil red, Good blue, Neutral
// green (GLOSSARY.md). Allegiance 0 is Evil and above 2 a mobilised Good
// Force (finding:mobilisation-allegiance-byte).
const sideColour = (force: Force): string =>
  force.leader.allegiance === 0
    ? '#b3372c'
    : force.leader.allegiance > 2
      ? '#2f58a8'
      : '#3f7d3a';

const [assets, bundle] = await Promise.all([
  loadCampaignAssets(),
  loadBundle('/assets/geography/bundle.bin')
]);
const font: SdfFont = buildSdfFont(
  " ABCDEFGHIJKLMNOPQRSTUVWXYZÛabcdefghijklmnopqrstuvwxyz0123456789'-.,()&"
);
const pictograms = buildPictogramAtlas([...bundle.pictograms, ...PEAKS]);
const renderer = new AtlasRenderer(
  canvas,
  bundle,
  font,
  assets.forceIcons as TexImageSource & { height: number; width: number },
  pictograms
);
let sim: SimState = createSim(0x14_18, assets.startingState, assets.tilemap);
let running = false;

const mapSize = { height: bundle.bounds[3], width: bundle.bounds[2] };
const selected = new Set<number>();
const tiers = new Map<number, Tier>();
let band: Band | undefined;

// The camera: the map point at the centre of the window, and zoom in CSS
// pixels per map pixel.
const camera = { x: 0, y: 0, zoom: 1 };
let range: ZoomRange = zoomRange(
  { height: innerHeight, width: innerWidth },
  mapSize
);

const clampCamera = (): void => {
  camera.zoom = Math.min(range.max, Math.max(range.min, camera.zoom));
  const halfW = innerWidth / 2 / camera.zoom;
  const halfH = innerHeight / 2 / camera.zoom;
  const clampAxis = (v: number, half: number, size: number): number =>
    half * 2 >= size ? size / 2 : Math.min(size - half, Math.max(half, v));
  camera.x = clampAxis(camera.x, halfW, mapSize.width);
  camera.y = clampAxis(camera.y, halfH, mapSize.height);
};

const resize = (): void => {
  const dpr = devicePixelRatio;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  range = zoomRange({ height: innerHeight, width: innerWidth }, mapSize);
  clampCamera();
};
addEventListener('resize', resize);
resize();

// Start over Rivendell at the Campaign Level's scale.
const rivendell = bundle.places.find(p =>
  p.name.toUpperCase().includes('RIVENDELL')
);
camera.x = rivendell?.x ?? mapSize.width / 2;
camera.y = rivendell?.y ?? mapSize.height / 2;
camera.zoom = range.campaign;
// `?at=x,y,zoom` opens on a map point, zoom a multiple of the Campaign
// Level's scale.
const at = new URLSearchParams(location.search)
  .get('at')
  ?.split(',')
  .map(Number);
if (at?.length === 3 && at.every(Number.isFinite)) {
  [camera.x, camera.y] = [at[0]!, at[1]!];
  camera.zoom = range.campaign * at[2]!;
}
clampCamera();

const toScreen = (x: number, y: number): [number, number] => [
  (x - camera.x) * camera.zoom + innerWidth / 2,
  (y - camera.y) * camera.zoom + innerHeight / 2
];
const toMap = (sx: number, sy: number): [number, number] => [
  (sx - innerWidth / 2) / camera.zoom + camera.x,
  (sy - innerHeight / 2) / camera.zoom + camera.y
];

const zoomAt = (factor: number, sx: number, sy: number): void => {
  const [mx, my] = toMap(sx, sy);
  camera.zoom *= factor;
  clampCamera();
  const [nx, ny] = toMap(sx, sy);
  camera.x += mx - nx;
  camera.y += my - ny;
  clampCamera();
};

// Text, in CSS pixels, as glyph quads in device pixels: an ink fill over
// a paper halo.
const textQuads = (
  text: string,
  x: number,
  y: number,
  px: number,
  colour: string,
  halo: string | null,
  tracking: number,
  opacity = 1
): Quad[] => {
  const dpr = devicePixelRatio;
  const scale = px / font.size;
  const quads: Quad[] = [];
  let pen = x;
  for (const ch of text) {
    const glyph = font.glyphs.get(ch);
    if (glyph) {
      const box = {
        h: font.cell * scale * dpr,
        u0: glyph.u,
        u1: glyph.u + font.cell,
        v0: glyph.v,
        v1: glyph.v + font.cell,
        w: font.cell * scale * dpr,
        x: (pen - font.radius * scale) * dpr,
        y: (y - (font.radius + font.size) * scale) * dpr
      };
      if (halo) {
        quads.push({
          ...box,
          colour: rgba(halo, 0.9 * opacity),
          edge: 0.3,
          mode: QuadMode.glyph
        });
      }
      quads.push({
        ...box,
        colour: rgba(colour, opacity),
        edge: 0.5,
        mode: QuadMode.glyph
      });
    }
    pen += (glyph?.advance ?? font.size * 0.5) * scale + tracking;
  }
  // Halos first, so no halo covers a neighbouring letter's ink.
  return [
    ...quads.filter(q => q.edge === 0.3),
    ...quads.filter(q => q.edge !== 0.3)
  ];
};

interface Drawn {
  // The screen box it can be picked in, CSS pixels.
  box: { h: number; w: number; x: number; y: number };
  force: Force;
}
let drawn: Drawn[] = [];

const AREA = bundle.pictograms.indexOf('area');
// Bridges and fords are drawn across their rivers, not as pictures.
const CROSSINGS = new Set(
  ['bridge', 'ford'].map(name => bundle.pictograms.indexOf(name))
);
// A Place's picture grows with the map, between a least and greatest size
// in CSS pixels; Strongholds are drawn larger.
const pictogramSize = (rank: number): number =>
  Math.min(48, Math.max(18, 20 * camera.zoom)) * (rank === 0 ? 1.25 : 1);
// The pictured Place a Force stands on, if any: Places are a tile apart
// at least, so within half a tile is on it.
const pictureUnder = (
  force: Force
): (typeof bundle.places)[number] | undefined =>
  bundle.places.find(
    p =>
      p.pictogram !== AREA &&
      Math.abs(p.x - force.position.x - SPRITE_SIZE / 2) <= 8 &&
      Math.abs(p.y - force.position.y - SPRITE_SIZE / 2) <= 8
  );

const isImportant = (force: Force): boolean =>
  selected.has(force.leader.index) ||
  (sim.ringBearer !== null &&
    force.members.some(m => m.index === sim.ringBearer));

const frame = (): void => {
  if (running) {
    sim = tickSim(sim);
  }
  const dpr = devicePixelRatio;
  band = bandAt(camera.zoom, range, band);
  const forces = forcesOnMap(sim.roster);
  const quads: Quad[] = [];
  const picks: Drawn[] = [];
  const counts: Record<Tier, number> = {
    aggregate: 0,
    compact: 0,
    dot: 0,
    figure: 0
  };

  const dots: { force: Force; x: number; y: number }[] = [];
  const figures: Quad[] = [];
  const markers: Quad[] = [];
  for (const force of forces) {
    const tier = tierFor(
      camera.zoom,
      range,
      isImportant(force),
      tiers.get(force.leader.index)
    );
    tiers.set(force.leader.index, tier);
    const [sx, sy] = toScreen(
      force.position.x + SPRITE_SIZE / 2,
      force.position.y + SPRITE_SIZE / 2
    );
    if (sx < -50 || sy < -50 || sx > innerWidth + 50 || sy > innerHeight + 50) {
      continue;
    }
    if (tier === 'figure') {
      const scale = spriteScale(camera.zoom, dpr);
      const size = SPRITE_SIZE * scale;
      const src = iconSourceRect(force.leader.icon);
      // A Force standing on a pictured Place stands beside its picture,
      // so the picture stays in view.
      const place = pictureUnder(force);
      const beside = place
        ? (pictogramSize(place.rank) * dpr) / 2 + size / 2
        : 0;
      // Whole device pixels, so the sprite stays crisp.
      const x = Math.round(sx * dpr - size / 2 + beside);
      const y = Math.round(sy * dpr - size / 2);
      if (selected.has(force.leader.index)) {
        markers.push({
          colour: rgba('#f6e7a8', 0.9),
          h: size * 1.3,
          mode: QuadMode.circle,
          w: size * 1.3,
          x: x - size * 0.15,
          y: y - size * 0.15
        });
      }
      figures.push({
        colour: [1, 1, 1, 1],
        h: size,
        mode: QuadMode.sprite,
        u0: src.x,
        u1: src.x + SPRITE_SIZE,
        v0: src.y,
        v1: src.y + SPRITE_SIZE,
        w: size,
        x,
        y
      });
      picks.push({
        box: { h: size / dpr, w: size / dpr, x: x / dpr, y: y / dpr },
        force
      });
      counts.figure++;
    } else if (tier === 'compact') {
      const size = 12;
      const ring = selected.has(force.leader.index) ? 4 : 0;
      if (ring) {
        markers.push({
          colour: rgba('#f6e7a8', 0.95),
          h: (size + ring * 2) * dpr,
          mode: QuadMode.circle,
          w: (size + ring * 2) * dpr,
          x: (sx - size / 2 - ring) * dpr,
          y: (sy - size / 2 - ring) * dpr
        });
      }
      // Characters are discs and Units squares.
      markers.push({
        colour: rgba(sideColour(force)),
        h: size * dpr,
        mode: force.leader.isUnit ? QuadMode.square : QuadMode.circle,
        w: size * dpr,
        x: (sx - size / 2) * dpr,
        y: (sy - size / 2) * dpr
      });
      picks.push({
        box: { h: size, w: size, x: sx - size / 2, y: sy - size / 2 },
        force
      });
      counts.compact++;
    } else {
      dots.push({ force, x: sx, y: sy });
    }
  }
  const clusters = clusterDots(
    dots.map((d, id) => ({ id, x: d.x, y: d.y })),
    9
  );
  const counters: Quad[] = [];
  for (const cluster of clusters) {
    const members = cluster.ids.map(id => dots[id]!);
    const size = cluster.ids.length > 1 ? 11 : 7;
    const first = members[0]!.force;
    const mixed = members.some(m => sideColour(m.force) !== sideColour(first));
    markers.push({
      colour: rgba(mixed ? '#7a6a52' : sideColour(first)),
      h: size * dpr,
      mode: QuadMode.circle,
      w: size * dpr,
      x: (cluster.x - size / 2) * dpr,
      y: (cluster.y - size / 2) * dpr
    });
    if (cluster.ids.length > 1) {
      for (const m of members) {
        tiers.set(m.force.leader.index, 'aggregate');
      }
      counts.aggregate++;
      const label = String(cluster.ids.length);
      counters.push(
        ...textQuads(label, cluster.x + 6, cluster.y - 4, 11, INK, PAPER, 0)
      );
    } else {
      counts.dot++;
      picks.push({
        box: {
          h: size,
          w: size,
          x: cluster.x - size / 2,
          y: cluster.y - size / 2
        },
        force: first
      });
    }
  }

  // Region names, large and widely spaced as on Tolkien's maps, fade out
  // as the map zooms in to the Campaign Level's scale; the smaller
  // regions, such as the Shire, only show from the Campaign Level band.
  const regionLabels = bundle.regionLabels
    .map(r => {
      const fadeIn =
        r.rank === 0 ? 1 : clamp01((camera.zoom / range.boundary - 0.8) / 0.4);
      const opacity = Math.min(
        fadeIn,
        clamp01((range.campaign * 0.6 - camera.zoom) / (range.campaign * 0.25))
      );
      const px = r.rank === 0 ? 20 : 15;
      const tracking = r.rank === 0 ? 7 : 4;
      const width = measure(font, r.name, px, tracking);
      const [sx, sy] = toScreen(r.x, r.y);
      return {
        box: { height: px, width, x: sx - width / 2, y: sy - px / 2 },
        colour: REGION_INK,
        opacity,
        px,
        text: r.name,
        tracking
      };
    })
    .filter(l => l.opacity > 0.02);
  // Place names, the most important first, never overlapping.
  const labels = bundle.places
    .filter(p => camera.zoom >= rankZoom(p.rank, range))
    .sort((a, b) => a.rank - b.rank)
    .map(p => {
      const px = p.rank === 0 ? 15 : 12;
      const tracking = p.rank === 0 ? 1.5 : 0.6;
      const text = p.name.toUpperCase();
      const width = measure(font, text, px, tracking);
      const [sx, sy] = toScreen(p.x, p.y);
      // Named country is lettered where it lies; a pictured Place is
      // lettered under its picture.
      const area = p.pictogram === AREA;
      const half = pictogramSize(p.rank) / 2;
      const at = (x: number, y: number) => ({ height: px, width, x, y });
      return {
        // Clear of any Force there: above the picture, then to either side.
        alternatives: area
          ? []
          : [
              at(sx - width / 2, sy - half - px - 2),
              at(sx + half + 4, sy - px / 2),
              at(sx - half - 4 - width, sy - px / 2)
            ],
        box: at(sx - width / 2, area ? sy - px / 2 : sy + half + 2),
        colour: area ? REGION_INK : INK,
        // A Stronghold's name always shows; lesser names give way.
        keep: p.rank === 0,
        opacity: 1,
        px,
        text,
        tracking
      };
    })
    .filter(
      l =>
        l.box.x + l.box.width > 0 &&
        l.box.x < innerWidth &&
        l.box.y < innerHeight &&
        l.box.y + l.box.height > 0
    );
  const forceBoxes = picks.map(({ box }) => ({
    height: box.h,
    width: box.w,
    x: box.x,
    y: box.y
  }));
  const lettering = placeLabels(
    [...regionLabels, ...labels],
    forceBoxes
  ).flatMap(l =>
    textQuads(
      l.text,
      l.box.x,
      l.box.y + l.px * 0.8,
      l.px,
      l.colour,
      PAPER,
      l.tracking,
      l.opacity
    )
  );
  // Each pictured Place's ink picture.
  const places = bundle.places
    .filter(
      p =>
        p.pictogram !== AREA &&
        !CROSSINGS.has(p.pictogram) &&
        camera.zoom >= rankZoom(p.rank, range)
    )
    .flatMap((p): Quad[] => {
      const cell = pictograms.cells.get(bundle.pictograms[p.pictogram]!);
      if (!cell) {
        return [];
      }
      const [sx, sy] = toScreen(p.x, p.y);
      // The picture's 64-unit box is `size` across; its cell has a margin
      // for the distance field either side.
      const size = pictogramSize(p.rank);
      const quad =
        (size * pictograms.cell) / (pictograms.cell - pictograms.margin * 2);
      return [
        {
          colour: [1, 1, 1, 1],
          h: quad * dpr,
          mode: QuadMode.pictogram,
          u0: cell.u,
          u1: cell.u + pictograms.cell,
          v0: cell.v,
          v1: cell.v + pictograms.cell,
          w: quad * dpr,
          x: (sx - quad / 2) * dpr,
          y: (sy - quad / 2) * dpr
        }
      ];
    });

  quads.push(...places, ...lettering, ...markers, ...figures, ...counters);
  drawn = picks;
  const maxRank = [2, 1, 0].find(r => camera.zoom >= rankZoom(r, range)) ?? 0;
  const lineScale = Math.min(
    1.6,
    Math.max(0.55, camera.zoom / range.campaign + 0.4)
  );
  const [left, top] = toMap(0, 0);
  renderer.draw(
    {
      devicePixelRatio: dpr,
      height: canvas.height,
      width: canvas.width,
      x: left,
      y: top,
      zoom: camera.zoom
    },
    quads,
    maxRank,
    lineScale,
    // Roads show from just below the Campaign Level band.
    clamp01((camera.zoom / range.boundary - 0.6) / 0.4)
  );

  const bandName = band === 'campaign' ? 'Campaign Level' : 'Full Map Level';
  hud.innerHTML = [
    `<b>${bandName}</b> band · zoom ${(camera.zoom / range.campaign).toFixed(2)}× Campaign`,
    band === 'campaign'
      ? 'Orders: available'
      : 'Mirror and Saved Game: available · Orders: zoom in',
    `Forces: ${counts.figure} figure · ${counts.compact} compact · ${counts.dot} dot · ${counts.aggregate} aggregate`,
    `${running ? 'Running' : 'Paused'} (space) · click a Force to select it · Home fits the map`
  ].join('<br>');
  requestAnimationFrame(frame);
};

// Input: wheel and pinch zoom about the pointer, drag to pan, click to
// select.
canvas.addEventListener(
  'wheel',
  event => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomAt(Math.exp(-delta * 0.0015), event.clientX, event.clientY);
  },
  { passive: false }
);
const pointers = new Map<number, { x: number; y: number }>();
let moved = 0;
canvas.addEventListener('pointerdown', event => {
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  moved = 0;
});
canvas.addEventListener('pointermove', event => {
  const last = pointers.get(event.pointerId);
  if (!last) {
    return;
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.entries()].map(([id, p]) =>
      id === event.pointerId ? { x: event.clientX, y: event.clientY } : p
    );
    const [oa, ob] = [...pointers.values()];
    const before = Math.hypot(oa!.x - ob!.x, oa!.y - ob!.y);
    const after = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    if (before > 0) {
      zoomAt(after / before, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
    }
  } else {
    camera.x -= (event.clientX - last.x) / camera.zoom;
    camera.y -= (event.clientY - last.y) / camera.zoom;
    clampCamera();
  }
  moved += Math.abs(event.clientX - last.x) + Math.abs(event.clientY - last.y);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
});
const release = (event: PointerEvent): void => {
  if (pointers.size === 1 && moved < 4) {
    const hit = [...drawn]
      .reverse()
      .find(
        ({ box }) =>
          event.clientX >= box.x &&
          event.clientX < box.x + box.w &&
          event.clientY >= box.y &&
          event.clientY < box.y + box.h
      );
    if (hit) {
      const id = hit.force.leader.index;
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
    }
  }
  pointers.delete(event.pointerId);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
addEventListener('keydown', event => {
  if (event.key === ' ') {
    running = !running;
    event.preventDefault();
  } else if (event.key === 'Home') {
    camera.zoom = range.min;
    clampCamera();
  } else if (event.key === '+' || event.key === '=') {
    zoomAt(1.25, innerWidth / 2, innerHeight / 2);
  } else if (event.key === '-') {
    zoomAt(0.8, innerWidth / 2, innerHeight / 2);
  }
});

requestAnimationFrame(frame);
