// The Atlas map's level-of-detail policy (ADR-0006): which zoom band the
// map is in, how each Force is drawn, how big Emblems are and which
// geography is shown. Zoom is CSS pixels per map pixel throughout.

// The original's Campaign Level shows 320 map pixels across its 320
// pixel screen; the Atlas takes that much map across the window as the
// Campaign Level's own scale.
export const CAMPAIGN_VIEW_WIDTH = 320;
// Zoomed all the way in is this many times the Campaign Level's scale.
export const MAX_ZOOM_FACTOR = 4;
// A Force's icon is 16 by 16 map pixels (finding:ui-campaign-level-display).
export const SPRITE_SIZE = 16;
// An Emblem's 64-unit box covers this many map pixels, a little less
// than the original's 16-pixel icon so that Compact markers keep a band
// of zoom above the Full Map Level's, and is drawn between these sizes in CSS pixels: below the least it no
// longer reads (docs/spec/atlas-emblems.md), so the Emblem tier ends there.
export const EMBLEM_MAP_SIZE = 12;
export const EMBLEM_MIN_SIZE = 24;
export const EMBLEM_MAX_SIZE = 64;
// How far past a threshold the zoom must go before a tier changes back,
// so zooming across it does not flicker.
export const HYSTERESIS = 0.08;

export interface ZoomRange {
  // Between the Full Map and Campaign Level bands.
  boundary: number;
  // The Campaign Level's scale.
  campaign: number;
  max: number;
  // Fits the whole map in the window.
  min: number;
}

export const zoomRange = (
  viewport: { height: number; width: number },
  map: { height: number; width: number }
): ZoomRange => {
  const min = Math.min(
    viewport.width / map.width,
    viewport.height / map.height
  );
  const campaign = Math.max(min, viewport.width / CAMPAIGN_VIEW_WIDTH);
  return {
    boundary: Math.sqrt(min * campaign),
    campaign,
    max: campaign * MAX_ZOOM_FACTOR,
    min
  };
};

export type Band = 'campaign' | 'full-map';

export const bandAt = (
  zoom: number,
  range: ZoomRange,
  previous?: Band
): Band => {
  const edge =
    previous === 'campaign'
      ? range.boundary * (1 - HYSTERESIS)
      : previous === 'full-map'
        ? range.boundary * (1 + HYSTERESIS)
        : range.boundary;
  return zoom >= edge ? 'campaign' : 'full-map';
};

// From most to least detailed. Aggregates are decided afterwards, from
// dots that crowd each other on screen.
export const TIERS = ['emblem', 'compact', 'dot'] as const;
export type Tier = (typeof TIERS)[number] | 'aggregate';

// The zoom at or above which each tier is used: Emblems from where they
// are drawn at their least size, Compact markers through the rest of the
// Campaign Level band, dots in the Full Map Level band.
export const tierThresholds = (
  range: ZoomRange
): Record<(typeof TIERS)[number], number> => ({
  compact: range.boundary,
  dot: 0,
  emblem: Math.max(range.boundary, EMBLEM_MIN_SIZE / EMBLEM_MAP_SIZE)
});

// The tier a Force is drawn at. An important Force (selected, watched or
// the Ring-bearer) is drawn one tier more detailed than the zoom alone
// gives. `previous` is the tier it had last frame, for hysteresis.
export const tierFor = (
  zoom: number,
  range: ZoomRange,
  important: boolean,
  previous?: Tier
): (typeof TIERS)[number] => {
  const thresholds = tierThresholds(range);
  const previousIndex =
    previous === undefined || previous === 'aggregate'
      ? -1
      : TIERS.indexOf(previous);
  let index = TIERS.findIndex((tier, i) => {
    const edge = thresholds[tier];
    // Staying at a tier needs less zoom than reaching it.
    const factor =
      previousIndex === -1
        ? 1
        : i >= previousIndex
          ? 1 - HYSTERESIS
          : 1 + HYSTERESIS;
    return zoom >= edge * factor;
  });
  if (index === -1) {
    index = TIERS.length - 1;
  }
  return TIERS[important ? Math.max(0, index - 1) : index]!;
};

// An Emblem's size in CSS pixels: the map's own scale, held between its
// least and greatest sizes.
export const emblemSize = (zoom: number): number =>
  Math.min(EMBLEM_MAX_SIZE, Math.max(EMBLEM_MIN_SIZE, EMBLEM_MAP_SIZE * zoom));

export interface ScreenDot {
  id: number;
  x: number;
  y: number;
}

export interface Cluster {
  ids: number[];
  x: number;
  y: number;
}

// Merge dots that would overlap on screen into aggregates, greedily in
// the order given so the result is the same each frame for the same
// input. A dot joins the first cluster whose centre is within `radius`.
export const clusterDots = (dots: ScreenDot[], radius: number): Cluster[] => {
  const clusters: (Cluster & { sx: number; sy: number })[] = [];
  for (const dot of dots) {
    const near = clusters.find(
      c => Math.hypot(c.x - dot.x, c.y - dot.y) < radius
    );
    if (near) {
      near.ids.push(dot.id);
      near.sx += dot.x;
      near.sy += dot.y;
      near.x = near.sx / near.ids.length;
      near.y = near.sy / near.ids.length;
    } else {
      clusters.push({
        ids: [dot.id],
        sx: dot.x,
        sy: dot.y,
        x: dot.x,
        y: dot.y
      });
    }
  }
  return clusters.map(({ ids, x, y }) => ({ ids, x, y }));
};

// The least zoom at which geography of each rank is drawn: rank 0 always,
// rank 1 from the Campaign Level band, rank 2 from halfway to the
// Campaign Level's scale.
export const rankZoom = (rank: number, range: ZoomRange): number =>
  rank <= 0
    ? 0
    : rank === 1
      ? range.boundary
      : Math.max(range.boundary, range.campaign / 2);

// How strongly roads are inked: full from just below the Campaign Level
// band, easing down to a floor that keeps them legible across the Full
// Map Level without crowding the rivers.
export const ROAD_FAR_OPACITY = 0.6;
export const roadOpacity = (zoom: number, range: ZoomRange): number =>
  ROAD_FAR_OPACITY +
  (1 - ROAD_FAR_OPACITY) *
    Math.min(1, Math.max(0, (zoom / range.boundary - 0.6) / 0.4));

export interface Box {
  height: number;
  width: number;
  x: number;
  y: number;
}

// Keep labels from overlapping each other and the obstacles: take them in
// order (most important first), moving each to its first free place and
// dropping any with none.
export const placeLabels = <
  T extends { alternatives?: Box[]; box: Box; keep?: boolean }
>(
  labels: T[],
  // Boxes no label may cover, such as Forces on the map.
  obstacles: Box[] = [],
  gap = 4
): T[] => {
  const placed: T[] = [];
  const overlaps = (b: Box, p: Box): boolean =>
    b.x < p.x + p.width + gap &&
    b.x + b.width + gap > p.x &&
    b.y < p.y + p.height + gap &&
    b.y + b.height + gap > p.y;
  const free = (b: Box): boolean =>
    !placed.some(({ box }) => overlaps(b, box)) &&
    !obstacles.some(o => overlaps(b, o));
  for (const label of labels) {
    // Each label tries its own place, then its alternatives in order; one
    // that must show keeps its own place if none is free.
    const box = [label.box, ...(label.alternatives ?? [])].find(free);
    if (box) {
      placed.push({ ...label, box });
    } else if (label.keep) {
      placed.push(label);
    }
  }
  return placed;
};
