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

// Draw the Campaign Level into the native buffer. Tile blits are 1:1
// integer copies from the atlas, so a tile-aligned camera reproduces
// tools/render-campaign-map.ts output pixel-for-pixel for the same region.
export const drawCampaignLevel = (
  ctx: CanvasRenderingContext2D,
  assets: CampaignAssets,
  cameraIn: Camera
): void => {
  const { atlas, icons, tilemap, tiles } = assets;
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

  for (const { icon, x, y } of iconPlacements(icons)) {
    ctx.drawImage(icon.image, x, y);
  }
};
