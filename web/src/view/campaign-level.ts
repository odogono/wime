import {
  placeAt,
  placeKindForTile,
  tileOf,
  type Force,
  type Place,
  type PlaceKind,
  type Point
} from '../sim/index';
import type { CampaignAssets, CampaignIcon, Tilemap } from './assets';
import { NATIVE_HEIGHT, NATIVE_WIDTH } from './screen';

// The Campaign Level viewport: 20 by 12 tiles, 320 by 192 pixels of the
// 320 by 200 native screen (finding:map-campaign-viewport-20-by-12-tiles).
export const VIEW_TILES_WIDTH = 20;
export const VIEW_TILES_HEIGHT = 12;

// How close to the viewport edge the pointer counts as touching it, and
// how fast the map then scrolls. The manual only says scrolling continues
// while the pointer stays at the edge (finding:ui-campaign-level-display);
// the speed is provisional until it is observed in the original.
export const EDGE_PX = 4;
export const SCROLL_SPEED_PX_PER_SEC = 128;

export interface Camera {
  x: number;
  y: number;
}

export interface Direction {
  x: number;
  y: number;
}

export interface IconPlacement {
  icon: CampaignIcon;
  x: number;
  y: number;
}

export const viewWidthPx = (tilemap: Tilemap): number =>
  VIEW_TILES_WIDTH * tilemap.tile_width;

export const viewHeightPx = (tilemap: Tilemap): number =>
  VIEW_TILES_HEIGHT * tilemap.tile_height;

export const maxCamera = (tilemap: Tilemap): Camera => ({
  x: Math.max(0, tilemap.width * tilemap.tile_width - viewWidthPx(tilemap)),
  y: Math.max(0, tilemap.height * tilemap.tile_height - viewHeightPx(tilemap))
});

export const clampCamera = (camera: Camera, tilemap: Tilemap): Camera => {
  const max = maxCamera(tilemap);
  return {
    x: Math.min(max.x, Math.max(0, Math.round(camera.x))),
    y: Math.min(max.y, Math.max(0, Math.round(camera.y)))
  };
};

// Which way to scroll for a pointer at the given native-screen position
// inside the viewport, or no scroll away from the edges.
export const edgeScrollDirection = (
  pointer: Camera | null,
  tilemap: Tilemap,
  edgePx: number = EDGE_PX
): Direction => {
  if (!pointer) {
    return { x: 0, y: 0 };
  }
  return {
    x:
      pointer.x < edgePx
        ? -1
        : pointer.x >= viewWidthPx(tilemap) - edgePx
          ? 1
          : 0,
    y:
      pointer.y < edgePx
        ? -1
        : pointer.y >= viewHeightPx(tilemap) - edgePx
          ? 1
          : 0
  };
};

// Drag panning, Google Maps style: the map follows the pointer, so the
// camera moves against the drag. Native pointer pixels are map pixels,
// so the point grabbed stays under the pointer. This is a convenience
// the original did not have; edge scrolling above is its way.
export const dragCamera = (
  startCamera: Camera,
  startPointer: Camera,
  pointer: Camera,
  tilemap: Tilemap
): Camera =>
  clampCamera(
    {
      x: startCamera.x - (pointer.x - startPointer.x),
      y: startCamera.y - (pointer.y - startPointer.y)
    },
    tilemap
  );

export const stepCamera = (
  camera: Camera,
  direction: Direction,
  dtSeconds: number,
  tilemap: Tilemap,
  speedPxPerSec: number = SCROLL_SPEED_PX_PER_SEC
): Camera =>
  clampCamera(
    {
      x: camera.x + direction.x * speedPxPerSec * dtSeconds,
      y: camera.y + direction.y * speedPxPerSec * dtSeconds
    },
    tilemap
  );

// The icon column at the top right (finding:ui-pointer-and-icon-column),
// right-aligned two pixels from the screen edge.
export const iconPlacements = (icons: CampaignIcon[]): IconPlacement[] => {
  const placements: IconPlacement[] = [];
  let y = 2;
  for (const icon of icons) {
    placements.push({ icon, x: NATIVE_WIDTH - 2 - icon.image.width, y });
    y += icon.image.height + 2;
  }
  return placements;
};

export const isOverIcons = (
  pointer: Camera,
  placements: IconPlacement[]
): boolean =>
  placements.some(
    ({ icon, x, y }) =>
      pointer.x >= x &&
      pointer.x < x + icon.image.width &&
      pointer.y >= y &&
      pointer.y < y + icon.image.height
  );

// A Force is drawn as one 16 by 16 icon: its Leader's figure, or a
// Unit's badge (finding:ui-campaign-level-display).
export const FORCE_ICON_SIZE = 16;

// Where a roster entry's icon sits in the icon sheet (AMaps.res
// IMAG 100): the byte's high four bits are the sheet column and the
// low four bits the row, each cell 16 by 16
// (finding:graphics-campaign-icon-sheet-is-imag-100). The runtime
// sheet the original copies from is laid out transposed
// (finding:graphics-campaign-icon-index); the picture is the same.
export const iconSourceRect = (icon: number): Point => ({
  x: (icon >> 4) * FORCE_ICON_SIZE,
  y: (icon & 0xf) * FORCE_ICON_SIZE
});

// The Force whose icon covers a map point, if any. Forces are drawn in
// roster order, so where icons overlap the last drawn is the one the
// player sees and picks.
export const forceAtPoint = (forces: Force[], point: Point): Force | null => {
  for (let i = forces.length - 1; i >= 0; i--) {
    const force = forces[i]!;
    if (
      point.x >= force.position.x &&
      point.x < force.position.x + FORCE_ICON_SIZE &&
      point.y >= force.position.y &&
      point.y < force.position.y + FORCE_ICON_SIZE
    ) {
      return force;
    }
  }
  return null;
};

export type HoverTarget =
  | { force: Force; kind: 'force'; name: string }
  | { kind: 'place'; name: string };

// What the pointer is over at a map point: a Force's Leader first,
// then a named Place on that tile, then the generic kind of the tile
// itself (finding:places-kinds-matched-by-map-tile).
export const hoverTargetAt = (
  forces: Force[],
  places: Place[],
  placeKinds: PlaceKind[],
  tilemap: Tilemap,
  point: Point
): HoverTarget | null => {
  const force = forceAtPoint(forces, point);
  if (force) {
    return { force, kind: 'force', name: force.leader.name };
  }
  const place = placeAt(places, point);
  if (place) {
    return { kind: 'place', name: place.name };
  }
  const tile = tileOf(point);
  const tileNumber =
    tile.x >= 0 && tile.y >= 0
      ? tilemap.indices[tile.y * tilemap.width + tile.x]
      : undefined;
  const kind =
    tileNumber === undefined ? null : placeKindForTile(placeKinds, tileNumber);
  return kind ? { kind: 'place', name: kind } : null;
};

export type TopLeftWindow =
  { kind: 'hover'; name: string } | { kind: 'paused' } | null;

// The paused box and the hover name share the top-left window, so
// only one is drawn: the hover name replaces the paused box while the
// pointer is over something, and the box returns when it leaves. How
// the original treats a hover while paused has not been traced. An
// open message box, such as a clicked Force's window, takes the spot
// over both.
export const topLeftWindow = ({
  boxOpen = false,
  hoverName,
  paused
}: {
  boxOpen?: boolean;
  hoverName: string | null;
  paused: boolean;
}): TopLeftWindow => {
  if (boxOpen) {
    return null;
  }
  if (hoverName !== null) {
    return { kind: 'hover', name: hoverName };
  }
  return paused ? { kind: 'paused' } : null;
};

// Draw the Campaign Level into the native buffer. Tile blits are 1:1
// integer copies from the atlas, so a tile-aligned camera reproduces
// tools/render-campaign-map.ts output pixel-for-pixel for the same region.
//
// Each Force on the map is drawn as its Leader's icon at the Force's
// position, as the original copies the icon there
// (finding:graphics-campaign-icon-index). Active Forces flash
// (finding:ui-campaign-level-display): they are skipped while
// flashOn is false, which the caller toggles in real time. The flash
// rate of the original has not been traced.
export const drawCampaignLevel = (
  ctx: CanvasRenderingContext2D,
  assets: CampaignAssets,
  cameraIn: Camera,
  forces: Force[] = [],
  flashOn = true
): void => {
  const { atlas, forceIcons, icons, tilemap, tiles } = assets;
  const camera = clampCamera(cameraIn, tilemap);
  const { tile_height: tileHeight, tile_width: tileWidth } = tilemap;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

  const firstTileX = Math.floor(camera.x / tileWidth);
  const firstTileY = Math.floor(camera.y / tileHeight);
  const offsetX = firstTileX * tileWidth - camera.x;
  const offsetY = firstTileY * tileHeight - camera.y;

  for (let row = 0; row <= VIEW_TILES_HEIGHT; row++) {
    const tileY = firstTileY + row;
    if (tileY < 0 || tileY >= tilemap.height) {
      continue;
    }
    for (let col = 0; col <= VIEW_TILES_WIDTH; col++) {
      const tileX = firstTileX + col;
      if (tileX < 0 || tileX >= tilemap.width) {
        continue;
      }
      const tileIndex = tilemap.indices[tileY * tilemap.width + tileX];
      if (tileIndex === undefined || tileIndex >= tiles.tile_count) {
        continue;
      }
      ctx.drawImage(
        atlas,
        (tileIndex % tiles.columns) * tiles.tile_width,
        Math.floor(tileIndex / tiles.columns) * tiles.tile_height,
        tiles.tile_width,
        tiles.tile_height,
        offsetX + col * tileWidth,
        offsetY + row * tileHeight,
        tileWidth,
        tileHeight
      );
    }
  }

  for (const force of forces) {
    if (force.active && !flashOn) {
      continue;
    }
    const x = force.position.x - camera.x;
    const y = force.position.y - camera.y;
    if (
      x <= -FORCE_ICON_SIZE ||
      y <= -FORCE_ICON_SIZE ||
      x >= viewWidthPx(tilemap) ||
      y >= viewHeightPx(tilemap)
    ) {
      continue;
    }
    const source = iconSourceRect(force.leader.icon);
    if (
      source.x + FORCE_ICON_SIZE > forceIcons.width ||
      source.y + FORCE_ICON_SIZE > forceIcons.height
    ) {
      continue;
    }
    ctx.drawImage(
      forceIcons,
      source.x,
      source.y,
      FORCE_ICON_SIZE,
      FORCE_ICON_SIZE,
      x,
      y,
      FORCE_ICON_SIZE,
      FORCE_ICON_SIZE
    );
  }

  for (const { icon, x, y } of iconPlacements(icons)) {
    ctx.drawImage(icon.image, x, y);
  }
};
