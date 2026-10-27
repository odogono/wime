// The Atlas map (ADR-0006, docs/spec/atlas-map.md): the vector geography
// drawn with WebGL into its own canvas, zooming continuously from the
// Full Map Level band into the Campaign Level band, with the game's
// Forces at their level-of-detail tiers. Whoever owns it, the game or
// the prototype page, moves its camera and hands it the Forces to draw.
import type { Force } from '../../sim/index';
import { loadBundle, type GeographyBundle } from './bundle';
import { RING, emblemLayers, loadEmblemAtlas } from './emblems';
import {
  SPRITE_SIZE,
  bandAt,
  clusterDots,
  emblemSize,
  placeLabels,
  rankZoom,
  tierFor,
  zoomRange,
  type Band,
  type Tier,
  type ZoomRange
} from './lod';
import { PEAKS, buildPictogramAtlas, type PictogramAtlas } from './pictograms';
import { AtlasRenderer, INK, PAPER, QuadMode, type Quad } from './renderer';
import { buildSdfFont, measure, type SdfFont } from './sdf-font';

export interface Point {
  x: number;
  y: number;
}

// The map point at the middle of the canvas, and zoom in CSS pixels per
// map pixel.
export interface AtlasCamera extends Point {
  zoom: number;
}

export interface DrawOptions {
  // Active Forces flash, as on the Classic Campaign Level: they are not
  // drawn while this is false.
  flashOn: boolean;
  // Forces drawn one tier more detailed (docs/spec/atlas-map.md).
  important: (force: Force) => boolean;
  // The Ring-bearer's roster index: its Emblem carries the Ring mark.
  ringBearer?: number | null;
  // Forces ringed as selected.
  selected?: ReadonlySet<number>;
}

export interface AtlasMap {
  band(): Band;
  readonly bundle: GeographyBundle;
  readonly camera: AtlasCamera;
  readonly canvas: HTMLCanvasElement;
  centreOn(point: Point): void;
  draw(forces: Force[], options: DrawOptions, elapsedMs: number): void;
  // Glide to a camera over a short moment.
  flyTo(target: Partial<AtlasCamera>): void;
  // The Force drawn under a point on the canvas, in CSS pixels.
  forceAt(point: Point): Force | null;
  panBy(dx: number, dy: number): void;
  // Where the zoom lands for each band, at the current window size.
  range(): ZoomRange;
  resize(): void;
  // A canvas point, in CSS pixels, to a map point, and back.
  toMap(point: Point): Point;
  toScreen(point: Point): Point;
  zoomAt(factor: number, at: Point): void;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
// Region names are lettered in a lighter, browner ink.
const REGION_INK = '#6e5232';
// How long a flight between cameras takes.
const FLIGHT_MS = 450;

const rgba = (hex: string, alpha = 1): [number, number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255, alpha];
};

// Side colours as on the Full Map Level: Evil red, Good blue, Neutral
// green (GLOSSARY.md). Allegiance 0 is Evil and above 2 a mobilised Good
// Force (finding:mobilisation-allegiance-byte).
const RING_GOLD = '#c9a227';

const sideColour = (force: Force): string =>
  force.leader.allegiance === 0
    ? '#b3372c'
    : force.leader.allegiance > 2
      ? '#2f58a8'
      : '#3f7d3a';

export const createAtlasMap = async (
  canvas: HTMLCanvasElement,
  base = '/assets/'
): Promise<AtlasMap> => {
  const bundle = await loadBundle(`${base}geography/bundle.bin`);
  const font: SdfFont = buildSdfFont(
    " ABCDEFGHIJKLMNOPQRSTUVWXYZÛabcdefghijklmnopqrstuvwxyz0123456789'-.,()&"
  );
  const pictograms: PictogramAtlas = buildPictogramAtlas([
    ...bundle.pictograms,
    ...PEAKS
  ]);
  const emblems = await loadEmblemAtlas(base);
  const renderer = new AtlasRenderer(canvas, bundle, font, emblems, pictograms);
  // An emblem's 64-unit box in the atlas, in texels.
  const emblemRect = (
    name: string
  ): { u0: number; u1: number; v0: number; v1: number } => {
    const cell = emblems.cells[name]!;
    const art = emblems.cell - emblems.margin * 2;
    const u0 = cell.u + emblems.margin;
    const v0 = cell.v + emblems.margin;
    return { u0, u1: u0 + art, v0, v1: v0 + art };
  };
  // The Ring mark, a little over a quarter of the Emblem's width, on its
  // top right corner.
  const ringMark = (x: number, y: number, size: number): Quad => ({
    colour: rgba(RING_GOLD),
    h: size * 0.3,
    mode: QuadMode.emblem,
    w: size * 0.3,
    x: x + size * 0.62,
    y: y + size * 0.04,
    ...emblemRect(RING)
  });
  const mapSize = { height: bundle.bounds[3], width: bundle.bounds[2] };
  const camera: AtlasCamera = {
    x: mapSize.width / 2,
    y: mapSize.height / 2,
    zoom: 1
  };
  const tiers = new Map<number, Tier>();
  let band: Band | undefined;
  let flight: { from: AtlasCamera; t: number; to: AtlasCamera } | null = null;
  let drawn: {
    box: { h: number; w: number; x: number; y: number };
    force: Force;
  }[] = [];

  const width = (): number => canvas.clientWidth || innerWidth;
  const height = (): number => canvas.clientHeight || innerHeight;
  const range = (): ZoomRange =>
    zoomRange({ height: height(), width: width() }, mapSize);

  const clampCamera = (): void => {
    const r = range();
    camera.zoom = Math.min(r.max, Math.max(r.min, camera.zoom));
    const halfW = width() / 2 / camera.zoom;
    const halfH = height() / 2 / camera.zoom;
    const clampAxis = (v: number, half: number, size: number): number =>
      half * 2 >= size ? size / 2 : Math.min(size - half, Math.max(half, v));
    camera.x = clampAxis(camera.x, halfW, mapSize.width);
    camera.y = clampAxis(camera.y, halfH, mapSize.height);
  };

  const toScreen = ({ x, y }: Point): Point => ({
    x: (x - camera.x) * camera.zoom + width() / 2,
    y: (y - camera.y) * camera.zoom + height() / 2
  });
  const toMap = ({ x, y }: Point): Point => ({
    x: (x - width() / 2) / camera.zoom + camera.x,
    y: (y - height() / 2) / camera.zoom + camera.y
  });

  const zoomAt = (factor: number, at: Point): void => {
    flight = null;
    const before = toMap(at);
    camera.zoom *= factor;
    clampCamera();
    const after = toMap(at);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
  };

  const resize = (): void => {
    const dpr = devicePixelRatio;
    canvas.width = Math.round(width() * dpr);
    canvas.height = Math.round(height() * dpr);
    clampCamera();
  };

  // Text, in CSS pixels, as glyph quads in device pixels: an ink fill
  // over a paper halo.
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

  const AREA = bundle.pictograms.indexOf('area');
  // Bridges and fords are drawn across their rivers, not as pictures.
  const CROSSINGS = new Set(
    ['bridge', 'ford'].map(name => bundle.pictograms.indexOf(name))
  );
  // A Place's picture grows with the map, between a least and greatest
  // size in CSS pixels; Strongholds are drawn larger.
  const pictogramSize = (rank: number): number =>
    Math.min(48, Math.max(18, 20 * camera.zoom)) * (rank === 0 ? 1.25 : 1);
  // The pictured Place a Force stands on, if any: Places are a tile apart
  // at least, so within half a tile is on it.
  const pictureUnder = (
    force: Force
  ): GeographyBundle['places'][number] | undefined =>
    bundle.places.find(
      p =>
        p.pictogram !== AREA &&
        !CROSSINGS.has(p.pictogram) &&
        Math.abs(p.x - force.position.x - SPRITE_SIZE / 2) <= 8 &&
        Math.abs(p.y - force.position.y - SPRITE_SIZE / 2) <= 8
    );

  const stepFlight = (elapsedMs: number): void => {
    if (!flight) {
      return;
    }
    flight.t = Math.min(1, flight.t + elapsedMs / FLIGHT_MS);
    // Ease in and out, and move the zoom on a log scale so the glide
    // feels even.
    const e = flight.t * flight.t * (3 - 2 * flight.t);
    const { from, to } = flight;
    camera.zoom = Math.exp(
      Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e
    );
    camera.x = from.x + (to.x - from.x) * e;
    camera.y = from.y + (to.y - from.y) * e;
    clampCamera();
    if (flight.t >= 1) {
      flight = null;
    }
  };

  const draw = (
    forces: Force[],
    options: DrawOptions,
    elapsedMs: number
  ): void => {
    stepFlight(elapsedMs);
    const dpr = devicePixelRatio;
    const r = range();
    band = bandAt(camera.zoom, r, band);
    const picks: typeof drawn = [];
    const dots: { force: Force; x: number; y: number }[] = [];
    const emblemQuads: Quad[] = [];
    const markers: Quad[] = [];
    const selected = options.selected ?? new Set<number>();
    for (const force of forces) {
      const tier = tierFor(
        camera.zoom,
        r,
        options.important(force),
        tiers.get(force.leader.index)
      );
      tiers.set(force.leader.index, tier);
      const { x: sx, y: sy } = toScreen({
        x: force.position.x + SPRITE_SIZE / 2,
        y: force.position.y + SPRITE_SIZE / 2
      });
      if (sx < -50 || sy < -50 || sx > width() + 50 || sy > height() + 50) {
        continue;
      }
      const bearer =
        options.ringBearer != null &&
        force.members.some(m => m.index === options.ringBearer);
      if (tier === 'emblem') {
        const size = emblemSize(camera.zoom) * dpr;
        // A Force standing on a pictured Place stands beside its
        // picture, so the picture stays in view.
        const place = pictureUnder(force);
        const beside = place
          ? (pictogramSize(place.rank) * dpr) / 2 + size / 2
          : 0;
        const x = sx * dpr - size / 2 + beside;
        const y = sy * dpr - size / 2;
        picks.push({
          box: { h: size / dpr, w: size / dpr, x: x / dpr, y: y / dpr },
          force
        });
        if (force.active && !options.flashOn) {
          continue;
        }
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
        // A Unit's shield is laid with its device and mark.
        for (const layer of emblemLayers(force)) {
          emblemQuads.push({
            colour: rgba(sideColour(force)),
            h: size * layer.size,
            mode: QuadMode.emblem,
            w: size * layer.size,
            x: x + size * layer.x,
            y: y + size * layer.y,
            ...emblemRect(layer.name)
          });
        }
        if (bearer) {
          emblemQuads.push(ringMark(x, y, size));
        }
      } else if (tier === 'compact') {
        const size = 16;
        picks.push({
          box: { h: size, w: size, x: sx - size / 2, y: sy - size / 2 },
          force
        });
        if (selected.has(force.leader.index)) {
          const ring = 4;
          markers.push({
            colour: rgba('#f6e7a8', 0.95),
            h: (size + ring * 2) * dpr,
            mode: QuadMode.circle,
            w: (size + ring * 2) * dpr,
            x: (sx - size / 2 - ring) * dpr,
            y: (sy - size / 2 - ring) * dpr
          });
        }
        // The Emblem's outline: a banner for a Character, a shield for a
        // Unit.
        const x = (sx - size / 2) * dpr;
        const y = (sy - size / 2) * dpr;
        markers.push({
          colour: rgba(sideColour(force)),
          h: size * dpr,
          mode: QuadMode.compact,
          w: size * dpr,
          x,
          y,
          ...emblemRect(emblemLayers(force)[0]!.name)
        });
        if (bearer) {
          markers.push(ringMark(x, y, size * dpr));
        }
      } else {
        dots.push({ force, x: sx, y: sy });
      }
    }
    const counters: Quad[] = [];
    for (const cluster of clusterDots(
      dots.map((d, id) => ({ id, x: d.x, y: d.y })),
      9
    )) {
      const members = cluster.ids.map(id => dots[id]!);
      const size = cluster.ids.length > 1 ? 11 : 7;
      const first = members[0]!.force;
      const mixed = members.some(
        m => sideColour(m.force) !== sideColour(first)
      );
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
        counters.push(
          ...textQuads(
            String(cluster.ids.length),
            cluster.x + 6,
            cluster.y - 4,
            11,
            INK,
            PAPER,
            0
          )
        );
      } else {
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

    // Region names, large and widely spaced as on Tolkien's maps, fade
    // out as the map zooms in to the Campaign Level's scale; the smaller
    // regions, such as the Shire, only show from the Campaign Level band.
    const regionLabels = bundle.regionLabels
      .map(region => {
        const fadeIn =
          region.rank === 0
            ? 1
            : clamp01((camera.zoom / r.boundary - 0.8) / 0.4);
        const opacity = Math.min(
          fadeIn,
          clamp01((r.campaign * 0.6 - camera.zoom) / (r.campaign * 0.25))
        );
        const px = region.rank === 0 ? 20 : 15;
        const tracking = region.rank === 0 ? 7 : 4;
        const textWidth = measure(font, region.name, px, tracking);
        const at = toScreen(region);
        return {
          box: {
            height: px,
            width: textWidth,
            x: at.x - textWidth / 2,
            y: at.y - px / 2
          },
          colour: REGION_INK,
          opacity,
          px,
          text: region.name,
          tracking
        };
      })
      .filter(l => l.opacity > 0.02);
    // Pictured Places, the most important first: one whose picture would
    // land on a picture already drawn is left out, picture and name, so
    // Places that share a spot, such as Minas Tirith and the Rammas Forts,
    // show as the greater one.
    const pictured: GeographyBundle['places'] = [];
    const hidden = new Set<GeographyBundle['places'][number]>();
    for (const p of [...bundle.places].sort((a, b) => a.rank - b.rank)) {
      if (
        p.pictogram === AREA ||
        CROSSINGS.has(p.pictogram) ||
        camera.zoom < rankZoom(p.rank, r)
      ) {
        continue;
      }
      const at = toScreen(p);
      const size = pictogramSize(p.rank) * 0.8;
      const clash = pictured.some(q => {
        const other = toScreen(q);
        return (
          Math.abs(other.x - at.x) < size && Math.abs(other.y - at.y) < size
        );
      });
      if (clash) {
        hidden.add(p);
      } else {
        pictured.push(p);
      }
    }
    // Place names, the most important first, never overlapping each other
    // or a Force.
    const labels = bundle.places
      .filter(p => !hidden.has(p) && camera.zoom >= rankZoom(p.rank, r))
      .sort((a, b) => a.rank - b.rank)
      .map(p => {
        const px = p.rank === 0 ? 15 : 12;
        const tracking = p.rank === 0 ? 1.5 : 0.6;
        const text = p.name.toUpperCase();
        const textWidth = measure(font, text, px, tracking);
        const at = toScreen(p);
        // Named country is lettered where it lies; a pictured Place is
        // lettered under its picture.
        const area = p.pictogram === AREA;
        const half = pictogramSize(p.rank) / 2;
        const box = (x: number, y: number) => ({
          height: px,
          width: textWidth,
          x,
          y
        });
        return {
          // Clear of any Force there: above the picture, then to either
          // side.
          alternatives: area
            ? []
            : [
                box(at.x - textWidth / 2, at.y - half - px - 2),
                box(at.x + half + 4, at.y - px / 2),
                box(at.x - half - 4 - textWidth, at.y - px / 2)
              ],
          box: box(
            at.x - textWidth / 2,
            area ? at.y - px / 2 : at.y + half + 2
          ),
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
          l.box.x < width() &&
          l.box.y < height() &&
          l.box.y + l.box.height > 0
      );
    const lettering = placeLabels(
      [...regionLabels, ...labels],
      picks.map(({ box }) => ({
        height: box.h,
        width: box.w,
        x: box.x,
        y: box.y
      }))
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
    const places = pictured.flatMap((p): Quad[] => {
      const cell = pictograms.cells.get(bundle.pictograms[p.pictogram]!);
      if (!cell) {
        return [];
      }
      const at = toScreen(p);
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
          x: (at.x - quad / 2) * dpr,
          y: (at.y - quad / 2) * dpr
        }
      ];
    });

    drawn = picks;
    const maxRank =
      [2, 1, 0].find(rank => camera.zoom >= rankZoom(rank, r)) ?? 0;
    const lineScale = Math.min(
      1.6,
      Math.max(0.55, camera.zoom / r.campaign + 0.4)
    );
    const topLeft = toMap({ x: 0, y: 0 });
    renderer.draw(
      {
        devicePixelRatio: dpr,
        height: canvas.height,
        width: canvas.width,
        x: topLeft.x,
        y: topLeft.y,
        zoom: camera.zoom
      },
      [...places, ...lettering, ...markers, ...emblemQuads, ...counters],
      maxRank,
      lineScale,
      // Roads show from just below the Campaign Level band.
      clamp01((camera.zoom / r.boundary - 0.6) / 0.4)
    );
  };

  resize();
  camera.zoom = range().campaign;
  clampCamera();

  return {
    band: () => band ?? bandAt(camera.zoom, range()),
    bundle,
    camera,
    canvas,
    centreOn: point => {
      flight = null;
      camera.x = point.x;
      camera.y = point.y;
      clampCamera();
    },
    draw,
    flyTo: target => {
      const to = { ...camera, ...target };
      const r = range();
      to.zoom = Math.min(r.max, Math.max(r.min, to.zoom));
      flight = { from: { ...camera }, t: 0, to };
    },
    forceAt: point =>
      [...drawn]
        .reverse()
        .find(
          ({ box }) =>
            point.x >= box.x &&
            point.x < box.x + box.w &&
            point.y >= box.y &&
            point.y < box.y + box.h
        )?.force ?? null,
    panBy: (dx, dy) => {
      flight = null;
      camera.x -= dx / camera.zoom;
      camera.y -= dy / camera.zoom;
      clampCamera();
    },
    range,
    resize,
    toMap,
    toScreen,
    zoomAt
  };
};
